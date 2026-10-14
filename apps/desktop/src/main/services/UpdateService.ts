import { promises as fs } from 'node:fs'
import path from 'node:path'

import { app, Notification } from 'electron'
import { autoUpdater, CancellationToken } from 'electron-updater'
import type { AppUpdater, ProgressInfo, UpdateCheckResult, UpdateInfo } from 'electron-updater'

import { getDesktopUpdateConfig } from '@/envs/desktop'
import type { DesktopUpdatePreferences, DesktopUpdateRelease, DesktopUpdateSource, DesktopUpdateState } from '@/types/desktopUpdater'
import {
  DEFAULT_UPDATE_PREFERENCES,
  getUpdateChannel,
  getUpdateSourceFromUrl,
  isUpdatePreferences,
  normalizeUpdatePreferences,
  resolveUpdateSource,
} from '@/types/desktopUpdater'

import { createLogger, redactLogText } from '../logger'
import type { DesktopConfigService } from './DesktopConfigService'
import { checkUpdateInstallationSupport } from './updateInstallationSupport'
import { readUpdateLogs } from './updateLogs'

const INITIAL_CHECK_DELAY = 5_000
const CHECK_INTERVAL = 4 * 60 * 60 * 1_000
const RETRY_DELAY = 5 * 60 * 1_000

type UpdateFeed = Parameters<AppUpdater['setFeedURL']>[0]

function toFeed(source: DesktopUpdateSource): UpdateFeed {
  if (source.type === 'github') return { provider: 'github', owner: source.owner, repo: source.repo }
  return { provider: 'generic', url: source.url }
}

function getUpdateErrorMessage(error: unknown, status: DesktopUpdateState['status']) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  const message = error instanceof Error ? error.message : String(error)
  if (/code signature|code requirement|signature_invalid|invalid_signature/i.test(`${code} ${message}`)) {
    return '更新包签名校验未通过。请手动安装正式签名版本后再尝试自动更新。'
  }
  if (status === 'installing') return '更新安装失败，请重试或手动安装新版本。'
  return '更新失败，请检查网络或更新源后重试。'
}

function toRelease(info: UpdateInfo): DesktopUpdateRelease {
  const notes = info.releaseNotes
  return {
    version: info.version,
    notes: typeof notes === 'string' ? notes : notes?.map((note) => note.note).join('\n\n') || '',
  }
}

/** Main-process owner of update state. Pages only query snapshots and subscribe. */
export class UpdateService {
  private readonly logger = createLogger('desktop:update')
  private initialization: Promise<void> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private operation: Promise<void> | null = null
  private cancellation: CancellationToken | null = null
  private generation = 0
  private invalidated = false
  private changingPreferences = false
  private clearingCache = false
  private disposed = false
  private failures = 0
  private defaultSource: DesktopUpdateSource | null = null
  private defaultFeed: UpdateFeed | null = null
  private removeRunListeners: (() => void) | null = null
  private state: DesktopUpdateState = {
    revision: 0,
    status: 'idle',
    currentVersion: app.getVersion(),
    developmentCachePath: null,
    installationSupport: null,
    preferences: { ...DEFAULT_UPDATE_PREFERENCES },
    effectiveSource: null,
    progress: 0,
    release: null,
    message: null,
    manual: false,
  }

  constructor(
    private readonly config: DesktopConfigService,
    private readonly publish: (state: DesktopUpdateState) => void,
    private readonly updater: AppUpdater = autoUpdater
  ) {
    this.updater.logger = this.logger
  }

  start(): Promise<void> {
    this.initialization ??= this.initialize()
    return this.initialization
  }

  private async initialize() {
    const configPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app-update.yml')
      : path.join(app.getAppPath(), 'dev-app-update.yml')
    this.logger.info('Initializing updater', {
      version: this.state.currentVersion,
      packaged: app.isPackaged,
      platform: process.platform,
      arch: process.arch,
      configPath,
    })
    const config = await this.config.read()
    if (this.disposed) return
    this.state.preferences = normalizeUpdatePreferences(config.updatePreferences)
    this.updater.autoDownload = false
    this.updater.autoInstallOnAppQuit = false
    this.updater.allowDowngrade = false
    // Keep an error listener even when a missing development source is configured later.
    this.updater.on('error', this.logError)
    if (!app.isPackaged) {
      this.updater.forceDevUpdateConfig = true
      this.updater.disableDifferentialDownload = true
    }
    this.state.installationSupport = await checkUpdateInstallationSupport({
      isPackaged: app.isPackaged,
      platform: process.platform,
      onError: (error) => this.logger.warn('Installation signature check failed', error),
    })
    this.logger.info('Update installation support', this.state.installationSupport)
    if (this.disposed) return
    const reason = await this.unsupportedReason()
    if (this.disposed) return
    if (reason) {
      this.logger.warn('Updater unsupported', reason)
      this.state.installationSupport = { ...this.state.installationSupport, supported: false, message: reason }
      this.update({ status: 'unsupported', message: reason })
      return
    }
    try {
      if (app.isPackaged) {
        const feed = await this.updater['loadUpdateConfig']()
        this.defaultFeed = feed
        if ('url' in feed && typeof feed.url === 'string') {
          this.defaultSource = getUpdateSourceFromUrl(feed.url)
          this.logger.info('Packaged update source', redactLogText(feed.url))
        } else if (feed.provider === 'github') {
          this.defaultSource = { type: 'github', owner: feed.owner, repo: feed.repo }
        }
      } else if (!this.state.preferences.updateSource) {
        const updateUrl = getDesktopUpdateConfig().PURECHAT_DESKTOP_UPDATE_URL
        if (updateUrl) {
          this.defaultSource = getUpdateSourceFromUrl(updateUrl)
          this.defaultFeed = { provider: 'generic', url: updateUrl }
          this.logger.info('Development update source', redactLogText(updateUrl))
        }
      }
      const source = resolveUpdateSource(this.state.preferences, this.defaultSource)
      if (!source && !app.isPackaged) {
        this.update({ status: 'unsupported', message: '开发版下载更新需要配置 PURECHAT_DESKTOP_UPDATE_URL，或在更新来源中保存地址。' })
        return
      }
      if (source && (this.state.preferences.updateSource || !app.isPackaged)) {
        this.updater.setFeedURL(this.state.preferences.updateSource ? toFeed(source) : this.defaultFeed!)
      }
      this.state.effectiveSource = source
      if (!app.isPackaged) {
        const helper = await this.updater['getOrCreateDownloadHelper']()
        this.state.developmentCachePath = helper.cacheDir
        this.logger.info('Development update cache', helper.cacheDir)
      }
    } catch (error) {
      this.logger.error('Updater source initialization failed', error)
      this.update({ status: 'unsupported', message: '更新源配置无效，请检查更新来源设置或打包配置。' })
      return
    }
    this.update({ status: 'idle', message: this.state.installationSupport.supported ? null : this.state.installationSupport.message })
    this.schedule(INITIAL_CHECK_DELAY)
  }

  private async unsupportedReason(): Promise<string | null> {
    // electron-builder supplies this runtime marker for portable executables.
    if (process.platform === 'win32' && 'PORTABLE_EXECUTABLE_DIR' in process.env) {
      return '便携版请前往发布页面下载新版本。'
    }
    if (process.platform !== 'win32' && process.platform !== 'darwin') {
      return '当前平台暂不支持自动更新，请前往发布页面下载。'
    }
    try {
      const configPath = app.isPackaged
        ? path.join(process.resourcesPath, 'app-update.yml')
        : path.join(app.getAppPath(), 'dev-app-update.yml')
      await fs.access(configPath)
      return null
    } catch (error) {
      this.logger.warn('Update configuration unavailable', error)
      return app.isPackaged
        ? '此构建未配置更新源，请前往发布页面下载新版本。'
        : '缺少 dev-app-update.yml，请检查桌面开发更新配置。'
    }
  }

  private readonly logError = (error: Error) => {
    this.logger.error(`Updater error during ${this.state.status}`, error)
  }

  private update(patch: Partial<DesktopUpdateState>) {
    if (this.disposed) return
    this.state = { ...this.state, ...patch, revision: this.state.revision + 1 }
    this.publish(this.snapshot())
  }

  private snapshot(): DesktopUpdateState {
    return {
      ...this.state,
      preferences: { ...this.state.preferences },
      effectiveSource: this.state.effectiveSource ? { ...this.state.effectiveSource } : null,
      installationSupport: this.state.installationSupport ? { ...this.state.installationSupport } : null,
      release: this.state.release ? { ...this.state.release } : null,
    }
  }

  async getState(): Promise<DesktopUpdateState> {
    await this.start()
    return this.snapshot()
  }

  getLogs() {
    return readUpdateLogs()
  }

  async check(manual = true): Promise<DesktopUpdateState> {
    await this.start()
    // Drain cancelled requests before reusing the singleton, so old-channel
    // events cannot be attributed to the new request.
    if (this.invalidated && this.operation) await this.operation
    if (this.disposed || this.changingPreferences || this.clearingCache || this.operation) return this.snapshot()
    if (
      this.state.status === 'unsupported' ||
      this.state.status === 'ready' ||
      this.state.status === 'downloaded' ||
      this.state.status === 'installing'
    ) {
      return this.snapshot()
    }
    if (!manual && !this.state.preferences.autoUpdate) return this.snapshot()
    this.clearTimer()
    this.invalidated = false
    const generation = ++this.generation
    const token = new CancellationToken()
    this.cancellation = token
    this.updater.channel = getUpdateChannel(this.state.preferences)
    // The channel setter can enable downgrade; always reset it afterwards.
    this.updater.allowDowngrade = false
    this.updater.allowPrerelease = this.state.preferences.testPlan
    this.logger.info('Checking for updates', {
      generation,
      manual,
      channel: this.updater.channel,
      currentVersion: this.state.currentVersion,
    })
    this.attachRunListeners(generation)
    this.update({ status: 'checking', progress: 0, release: null, message: null, manual })
    this.operation = this.performCheck(generation, token).finally(() => {
      this.operation = null
      this.cancellation = null
      const delay = this.failures
        ? Math.min(RETRY_DELAY * 2 ** (this.failures - 1), CHECK_INTERVAL / 4)
        : CHECK_INTERVAL
      this.schedule(delay)
    })
    return this.snapshot()
  }

  private isCurrent(generation: number) {
    return !this.disposed && generation === this.generation
  }

  private attachRunListeners(generation: number) {
    this.removeRunListeners?.()
    let lastProgressBucket = -1
    const onProgress = (progress: ProgressInfo) => {
      if (!this.isCurrent(generation) || this.state.status !== 'downloading') return
      const percent = Number.isFinite(progress.percent) ? Math.max(0, Math.min(100, progress.percent)) : 0
      const bucket = Math.floor(percent / 10)
      if (bucket > lastProgressBucket) {
        lastProgressBucket = bucket
        this.logger.info('Download progress', {
          generation,
          percent: bucket * 10,
          transferred: progress.transferred,
          total: progress.total,
          bytesPerSecond: progress.bytesPerSecond,
        })
      }
      this.update({ progress: percent })
    }
    const onDownloaded = (info: UpdateInfo) => {
      if (!this.isCurrent(generation) || this.state.status !== 'downloading') return
      if (this.state.release?.version !== info.version) return
      const isPackaged = app.isPackaged
      this.logger.info('Update downloaded', { generation, version: info.version, installable: isPackaged })
      this.update({
        status: isPackaged ? 'ready' : 'downloaded',
        progress: 100,
        release: toRelease(info),
        message: isPackaged
          ? (this.state.installationSupport?.supported ? null : this.state.installationSupport?.message || '尚未完成安装条件检查。')
          : '更新已下载。开发版本不会安装此更新。',
      })
      if (isPackaged && Notification.isSupported()) {
        new Notification({ title: 'PureChat 更新已就绪', body: '请在关于页面确认重启并安装更新。' }).show()
      }
    }
    const onError = (error: Error) => {
      if (!this.isCurrent(generation)) return
      this.update({ status: 'error', progress: 0, message: getUpdateErrorMessage(error, this.state.status) })
    }
    this.updater.on('download-progress', onProgress)
    this.updater.on('update-downloaded', onDownloaded)
    this.updater.on('error', onError)
    this.removeRunListeners = () => {
      this.updater.off('download-progress', onProgress)
      this.updater.off('update-downloaded', onDownloaded)
      this.updater.off('error', onError)
    }
  }

  private async performCheck(generation: number, token: CancellationToken) {
    try {
      let result: UpdateCheckResult | null
      try {
        result = await this.updater.checkForUpdates()
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : null
        const requestedChannel = getUpdateChannel(this.state.preferences)
        const source = this.state.effectiveSource
        const shouldFallbackToStable =
          code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' &&
          requestedChannel !== 'latest' &&
          source?.type !== 'github'

        if (!shouldFallbackToStable) throw error

        this.logger.warn('Test channel metadata is missing; retrying with the stable channel', {
          channel: requestedChannel,
        })
        this.updater.channel = 'latest'
        this.updater.allowDowngrade = false
        this.updater.allowPrerelease = false
        this.update({ status: 'checking', progress: 0, release: null, message: null })
        result = await this.updater.checkForUpdates()
      }
      if (!this.isCurrent(generation)) return
      if (!result) throw new Error('Updater did not return a result')
      if (!result.isUpdateAvailable) {
        this.logger.info('No update available', { version: result.updateInfo.version })
        this.update({ status: 'upToDate', message: '当前已是最新版本。' })
      } else {
        this.logger.info('Downloading update', { generation, version: result.updateInfo.version })
        this.update({ status: 'downloading', release: toRelease(result.updateInfo) })
        await this.updater.downloadUpdate(token)
      }
      this.failures = 0
    } catch (error) {
      this.logger.error(`Update operation failed during ${this.state.status}`, error)
      if (!this.isCurrent(generation)) return
      this.failures += 1
      this.update({ status: 'error', progress: 0, message: getUpdateErrorMessage(error, this.state.status) })
    }
  }

  async setPreferences(preferences: DesktopUpdatePreferences): Promise<DesktopUpdateState> {
    await this.start()
    if (this.disposed) throw new Error('更新服务已关闭')
    if (!isUpdatePreferences(preferences)) throw new Error('更新设置无效')
    if (this.clearingCache) throw new Error('正在清理更新缓存，请稍后再试')
    if (this.state.status === 'installing') throw new Error('正在安装更新，暂时不能修改设置')
    if (this.changingPreferences) throw new Error('正在保存更新设置，请稍后再试')
    this.changingPreferences = true
    const normalized = normalizeUpdatePreferences(preferences)
    const previous = this.state.preferences
    const previousSource = this.state.effectiveSource
    const source = resolveUpdateSource(normalized, this.defaultSource)
    const sourceChanged = JSON.stringify(source) !== JSON.stringify(previousSource)
    let feedChanged = false
    try {
      if (sourceChanged) {
        const reason = await this.unsupportedReason()
        if (reason) throw new Error(reason)
        this.clearTimer()
        this.cancelRun()
        this.update({ status: 'idle', progress: 0, release: null, message: null, manual: false })
        // The updater singleton retains check promises and a provider during downloads.
        // Drain those before changing its feed or deleting pending files.
        if (this.operation) await this.operation
        if (this.disposed) throw new Error('更新服务已关闭')
        await this.clearPendingUpdate()
        if (source) {
          feedChanged = true
          this.updater.setFeedURL(toFeed(source))
        }
      }
      await this.config.setUpdatePreferences(normalized)
      const channelChanged = getUpdateChannel(previous) !== getUpdateChannel(normalized)
      const stopBackground = !normalized.autoUpdate && !this.state.manual && this.operation !== null
      if (channelChanged || stopBackground) this.cancelRun()
      this.logger.info('Update preferences saved', {
        ...normalized,
        customUpdateUrl: normalized.customUpdateUrl ? redactLogText(normalized.customUpdateUrl) : undefined,
      })
      if (sourceChanged || channelChanged || stopBackground) {
        const unsupported = (sourceChanged && !source) || (!sourceChanged && this.state.status === 'unsupported')
        const status = unsupported ? 'unsupported' : 'idle'
        if (sourceChanged) this.failures = 0
        this.update({
          preferences: normalized,
          effectiveSource: source,
          status,
          progress: 0,
          release: null,
          manual: false,
          message: unsupported ? this.state.message || '尚未配置更新来源，请选择来源后保存。' : null,
        })
      } else this.update({ preferences: normalized })
      return this.snapshot()
    } catch (error) {
      if (feedChanged) {
        const previousFeed = previous.updateSource && previousSource ? toFeed(previousSource) : this.defaultFeed
        if (previousFeed) this.updater.setFeedURL(previousFeed)
      }
      if (sourceChanged && this.invalidated) {
        this.update({
          status: previousSource ? 'error' : 'unsupported',
          message: '保存更新来源失败，请重试或重新检查更新。',
        })
      }
      throw error
    } finally {
      this.changingPreferences = false
      this.schedule(INITIAL_CHECK_DELAY)
    }
  }

  private async clearPendingUpdate() {
    // electron-updater 6 exposes no public cache reset; reuse its configured helper.
    const helper = await this.updater['getOrCreateDownloadHelper']()
    if ('closeServerIfExists' in this.updater && typeof this.updater.closeServerIfExists === 'function') {
      this.updater.closeServerIfExists()
    }
    if ('squirrelDownloadedUpdate' in this.updater) this.updater.squirrelDownloadedUpdate = false
    await fs.rm(helper.cacheDirForPendingUpdate, { recursive: true, force: true })
    await helper.clear()
    if (!app.isPackaged) this.state.developmentCachePath = helper.cacheDir
  }

  async clearCache(): Promise<DesktopUpdateState> {
    if (app.isPackaged) throw new Error('仅开发环境支持清理下载安装包缓存。')
    await this.start()
    if (this.disposed || !this.state.developmentCachePath) throw new Error('开发更新缓存路径不可用。')
    if (this.operation || this.changingPreferences || this.clearingCache) {
      throw new Error('正在检查、下载或修改更新设置，请稍后再清理缓存。')
    }
    this.clearingCache = true
    this.clearTimer()
    this.cancelRun()
    try {
      const helper = await this.updater['getOrCreateDownloadHelper']()
      // clear() alone swallows filesystem errors and only empties pending; remove the whole update cache first.
      await fs.rm(helper.cacheDir, { recursive: true, force: true })
      await helper.clear()
      this.logger.info('Development update cache cleared', helper.cacheDir)
      this.failures = 0
      this.update({
        status: 'idle',
        progress: 0,
        release: null,
        manual: false,
        message: '下载安装包缓存已清理，可重新检查更新测试下载。',
      })
      return this.snapshot()
    } finally {
      this.clearingCache = false
      this.schedule(CHECK_INTERVAL)
    }
  }

  async install() {
    if (!app.isPackaged) throw new Error('开发版本仅支持下载更新，不能安装。')
    await this.start()
    if (!this.state.installationSupport?.supported) {
      this.logger.warn('Update installation blocked', this.state.installationSupport)
      throw new Error(this.state.installationSupport?.message || '尚未完成安装条件检查。')
    }
    if (this.state.status !== 'ready' || this.invalidated || this.changingPreferences) {
      throw new Error('更新尚未就绪，请重新检查更新')
    }
    this.clearTimer()
    this.update({ status: 'installing' })
    this.logger.info('User confirmed restart and install', { version: this.state.release?.version })
    try {
      this.updater.quitAndInstall(false, true)
    } catch (error) {
      this.logger.error('Update installation failed', error)
      this.update({ status: 'error', message: getUpdateErrorMessage(error, 'installing') })
      throw error
    }
  }

  private cancelRun() {
    if (this.cancellation) this.logger.info('Cancelling update operation', { generation: this.generation })
    this.generation += 1
    this.invalidated = true
    this.removeRunListeners?.()
    this.removeRunListeners = null
    this.cancellation?.cancel()
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private schedule(delay: number) {
    this.clearTimer()
    if (this.disposed || this.changingPreferences || !this.state.preferences.autoUpdate || this.state.status === 'unsupported') return
    if (this.state.status === 'ready' || this.state.status === 'downloaded' || this.state.status === 'installing')
      return
    this.logger.info(this.failures ? 'Scheduling update retry' : 'Scheduling update check', {
      delayMs: delay,
      failures: this.failures,
    })
    this.timer = setTimeout(() => {
      this.timer = null
      this.check(false).catch(this.logError)
    }, delay)
    this.timer.unref()
  }

  dispose() {
    this.disposed = true
    this.clearTimer()
    this.cancelRun()
    // Keep the harmless error listener until cancelled downloads have settled.
    const cleanup = () => this.updater.off('error', this.logError)
    if (this.operation) this.operation.finally(cleanup)
    else cleanup()
  }
}
