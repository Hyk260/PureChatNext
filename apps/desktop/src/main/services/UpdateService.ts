import { promises as fs } from 'node:fs'
import path from 'node:path'

import { app, Notification } from 'electron'
import { autoUpdater, CancellationToken } from 'electron-updater'
import type { AppUpdater, ProgressInfo, UpdateInfo } from 'electron-updater'

import { getDesktopUpdateConfig } from '@/envs/desktop'
import type { DesktopUpdatePreferences, DesktopUpdateRelease, DesktopUpdateState } from '@/types/desktopUpdater'
import { DEFAULT_UPDATE_PREFERENCES, getUpdateChannel, normalizeUpdatePreferences } from '@/types/desktopUpdater'

import type { DesktopConfigService } from './DesktopConfigService'

const INITIAL_CHECK_DELAY = 5_000
const CHECK_INTERVAL = 4 * 60 * 60 * 1_000
const RETRY_DELAY = 5 * 60 * 1_000

function toRelease(info: UpdateInfo): DesktopUpdateRelease {
  const notes = info.releaseNotes
  return {
    version: info.version,
    notes: typeof notes === 'string' ? notes : notes?.map((note) => note.note).join('\n\n') || '',
  }
}

/** Main-process owner of update state. Pages only query snapshots and subscribe. */
export class UpdateService {
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
  private removeRunListeners: (() => void) | null = null
  private state: DesktopUpdateState = {
    revision: 0,
    status: 'idle',
    currentVersion: app.getVersion(),
    developmentCachePath: null,
    preferences: { ...DEFAULT_UPDATE_PREFERENCES },
    progress: 0,
    release: null,
    message: null,
    manual: false,
  }

  constructor(
    private readonly config: DesktopConfigService,
    private readonly publish: (state: DesktopUpdateState) => void,
    private readonly updater: AppUpdater = autoUpdater
  ) {}

  start(): Promise<void> {
    this.initialization ??= this.initialize()
    return this.initialization
  }

  private async initialize() {
    const config = await this.config.read()
    if (this.disposed) return
    this.state.preferences = normalizeUpdatePreferences(config.updatePreferences)
    const reason = await this.unsupportedReason()
    if (this.disposed) return
    if (reason) {
      this.update({ status: 'unsupported', message: reason })
      return
    }
    if (!app.isPackaged) {
      const updateUrl = getDesktopUpdateConfig().PURECHAT_DESKTOP_UPDATE_URL
      if (!updateUrl) {
        this.update({ status: 'unsupported', message: '开发版下载更新需要配置 PURECHAT_DESKTOP_UPDATE_URL。' })
        return
      }
      try {
        this.updater.forceDevUpdateConfig = true
        // Local download tests use the full artifact, independent of cached blockmaps.
        this.updater.disableDifferentialDownload = true
        this.updater.setFeedURL({ provider: 'generic', url: updateUrl })
        // electron-updater 6 has no public cache API; use its helper to resolve the actual configured path.
        const helper = await this.updater['getOrCreateDownloadHelper']()
        this.state.developmentCachePath = helper.cacheDir
      } catch {
        this.update({ status: 'unsupported', message: '开发更新源配置无效，请检查 PURECHAT_DESKTOP_UPDATE_URL。' })
        return
      }
    }
    this.updater.autoDownload = false
    this.updater.autoInstallOnAppQuit = false
    this.updater.allowDowngrade = false
    // Keep an error listener while cancelled requests drain (EventEmitter's error is special).
    this.updater.on('error', this.logError)
    this.update({ status: 'idle' })
    this.schedule(INITIAL_CHECK_DELAY)
  }

  private async unsupportedReason(): Promise<string | null> {
    if (!app.isPackaged) {
      try {
        if (!getDesktopUpdateConfig().PURECHAT_DESKTOP_UPDATE_URL) {
          return '开发版下载更新需要配置 PURECHAT_DESKTOP_UPDATE_URL。'
        }
      } catch {
        return '开发更新源配置无效，请检查 PURECHAT_DESKTOP_UPDATE_URL。'
      }
    }
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
    } catch {
      return app.isPackaged
        ? '此构建未配置更新源，请前往发布页面下载新版本。'
        : '缺少 dev-app-update.yml，请检查桌面开发更新配置。'
    }
  }

  private readonly logError = (error: Error) => {
    console.warn('PureChat update failed', error.message)
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
      release: this.state.release ? { ...this.state.release } : null,
    }
  }

  async getState(): Promise<DesktopUpdateState> {
    await this.start()
    return this.snapshot()
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
    const onProgress = (progress: ProgressInfo) => {
      if (!this.isCurrent(generation) || this.state.status !== 'downloading') return
      const percent = Number.isFinite(progress.percent) ? Math.max(0, Math.min(100, progress.percent)) : 0
      this.update({ progress: percent })
    }
    const onDownloaded = (info: UpdateInfo) => {
      if (!this.isCurrent(generation) || this.state.status !== 'downloading') return
      if (this.state.release?.version !== info.version) return
      const isPackaged = app.isPackaged
      this.update({
        status: isPackaged ? 'ready' : 'downloaded',
        progress: 100,
        release: toRelease(info),
        message: isPackaged ? null : '更新已下载。开发版本不会安装此更新。',
      })
      if (isPackaged && Notification.isSupported()) {
        new Notification({ title: 'PureChat 更新已就绪', body: '请在关于页面确认重启并安装更新。' }).show()
      }
    }
    const onError = () => {
      if (!this.isCurrent(generation)) return
      this.update({ status: 'error', progress: 0, message: '更新失败，请检查网络或更新源后重试。' })
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
      const result = await this.updater.checkForUpdates()
      if (!this.isCurrent(generation)) return
      if (!result) throw new Error('Updater did not return a result')
      if (!result.isUpdateAvailable) {
        this.update({ status: 'upToDate', message: '当前已是最新版本。' })
      } else {
        this.update({ status: 'downloading', release: toRelease(result.updateInfo) })
        await this.updater.downloadUpdate(token)
      }
      this.failures = 0
    } catch {
      if (!this.isCurrent(generation)) return
      this.failures += 1
      this.update({ status: 'error', progress: 0, message: '更新失败，请检查网络或更新源后重试。' })
    }
  }

  async setPreferences(preferences: DesktopUpdatePreferences): Promise<DesktopUpdateState> {
    await this.start()
    if (this.clearingCache) throw new Error('正在清理更新缓存，请稍后再试')
    if (this.state.status === 'installing') throw new Error('正在安装更新，暂时不能修改设置')
    if (this.changingPreferences) throw new Error('正在保存更新设置，请稍后再试')
    this.changingPreferences = true
    try {
      await this.config.setUpdatePreferences(preferences)
      const previous = this.state.preferences
      const channelChanged = getUpdateChannel(previous) !== getUpdateChannel(preferences)
      const stopBackground = !preferences.autoUpdate && !this.state.manual && this.operation !== null
      if (channelChanged || stopBackground) this.cancelRun()
      const normalized = normalizeUpdatePreferences(preferences)
      if (channelChanged || stopBackground) {
        const status = this.state.status === 'unsupported' ? 'unsupported' : 'idle'
        this.update({
          preferences: normalized,
          status,
          progress: 0,
          release: null,
          manual: false,
          message: status === 'unsupported' ? this.state.message : null,
        })
      } else this.update({ preferences: normalized })
      this.schedule(INITIAL_CHECK_DELAY)
      return this.snapshot()
    } finally {
      this.changingPreferences = false
    }
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
    if (this.state.status !== 'ready' || this.invalidated || this.changingPreferences) {
      throw new Error('更新尚未就绪，请重新检查更新')
    }
    this.clearTimer()
    this.update({ status: 'installing' })
    try {
      this.updater.quitAndInstall(false, true)
    } catch (error) {
      this.update({ status: 'ready', message: '安装失败，请重试。' })
      throw error
    }
  }

  private cancelRun() {
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
    if (this.disposed || !this.state.preferences.autoUpdate || this.state.status === 'unsupported') return
    if (this.state.status === 'ready' || this.state.status === 'downloaded' || this.state.status === 'installing')
      return
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
