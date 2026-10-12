// @vitest-environment node
import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppUpdater, UpdateCheckResult, UpdateInfo } from 'electron-updater'
import { DownloadedUpdateHelper } from 'electron-updater/out/DownloadedUpdateHelper'

const mocks = vi.hoisted(() => ({
  packaged: true,
  notify: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  installationSupport: vi.fn(),
}))
vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.2.0',
    getAppPath: () => '/tmp/purechat-test-app',
    get isPackaged() {
      return mocks.packaged
    },
  },
  Notification: class {
    static isSupported() {
      return true
    }
    show = mocks.notify
  },
}))
vi.mock('electron-updater', () => ({
  autoUpdater: {},
  CancellationToken: class {
    cancelled = false
    cancel() {
      this.cancelled = true
    }
  },
}))

vi.mock('../../logger', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../logger')>()),
  createLogger: () => mocks.logger,
}))

import type { DesktopConfigService } from '../DesktopConfigService'
import { DEFAULT_UPDATE_PREFERENCES } from '@/types/desktopUpdater'
import type { DesktopUpdatePreferences } from '@/types/desktopUpdater'
import { UpdateService } from '../UpdateService'

vi.mock('../updateInstallationSupport', () => ({ checkUpdateInstallationSupport: mocks.installationSupport }))

class FakeUpdater extends EventEmitter {
  logger = mocks.logger
  loadUpdateConfig = vi.fn(async () => ({ url: 'http://127.0.0.1:5500' }))
  forceDevUpdateConfig = false
  disableDifferentialDownload = false
  autoDownload = true
  autoInstallOnAppQuit = true
  allowDowngrade = true
  allowPrerelease = false
  channel = 'latest'
  checkForUpdates = vi.fn<() => Promise<UpdateCheckResult | null>>()
  downloadUpdate = vi.fn().mockResolvedValue([])
  setFeedURL = vi.fn()
  quitAndInstall = vi.fn()
  downloadHelper: Pick<DownloadedUpdateHelper, 'cacheDir' | 'clear'> = {
    cacheDir: '/tmp/purechat-test-update-cache',
    clear: vi.fn().mockResolvedValue(undefined),
  }
  getOrCreateDownloadHelper = vi.fn(async () => this.downloadHelper)
}

const release: UpdateInfo = {
  version: '0.3.0',
  releaseDate: '',
  files: [],
  path: '',
  sha512: '',
  releaseNotes: 'Changes',
}
const result = (available = true): UpdateCheckResult => ({
  isUpdateAvailable: available,
  updateInfo: release,
  versionInfo: release,
})
const originalPlatform = process.platform
const originalResources = Object.getOwnPropertyDescriptor(process, 'resourcesPath')
let service: UpdateService
let updater: FakeUpdater
let preferences: DesktopUpdatePreferences
const config = {
  read: vi.fn(async () => ({ updatePreferences: preferences })),
  setUpdatePreferences: vi.fn(async (next: DesktopUpdatePreferences) => {
    preferences = next
  }),
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.packaged = true
  mocks.installationSupport.mockResolvedValue({ supported: true, signature: 'valid', message: '签名校验通过' })
  preferences = { ...DEFAULT_UPDATE_PREFERENCES }
  Object.defineProperty(process, 'platform', { configurable: true, value: 'darwin' })
  Object.defineProperty(process, 'resourcesPath', { configurable: true, value: '/tmp/purechat-test-resources' })
  vi.spyOn(fs, 'access').mockResolvedValue(undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  updater = new FakeUpdater()
  updater.checkForUpdates.mockResolvedValue(result())
  service = new UpdateService(config as unknown as DesktopConfigService, vi.fn(), updater as unknown as AppUpdater)
})
afterEach(() => {
  service.dispose()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform })
  if (originalResources) Object.defineProperty(process, 'resourcesPath', originalResources)
  else Reflect.deleteProperty(process, 'resourcesPath')
})

async function settle() {
  await vi.advanceTimersByTimeAsync(0)
}

describe('desktop updater', () => {
  it('allows an ad-hoc production build to download but rejects installation before calling the native updater', async () => {
    const support = { supported: false, signature: 'ad-hoc', message: '当前应用使用 ad-hoc 签名，仅支持下载更新。' }
    mocks.installationSupport.mockResolvedValue(support)
    await service.check()
    await settle()
    updater.emit('update-downloaded', release)
    expect(await service.getState()).toMatchObject({ status: 'ready', installationSupport: support, message: support.message })
    await expect(service.install()).rejects.toThrow('ad-hoc')
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
    expect(mocks.logger.warn).toHaveBeenCalledWith('Update installation blocked', support)
  })

  it('requires downloaded event to install, even at 100 percent, and uses the client version', async () => {
    expect((await service.getState()).currentVersion).toBe('0.2.0')
    await service.check()
    await settle()
    expect(updater.autoInstallOnAppQuit).toBe(false)
    updater.emit('download-progress', { percent: 120 })
    expect(await service.getState()).toMatchObject({
      status: 'downloading',
      progress: 100,
      release: { version: '0.3.0', notes: 'Changes' },
    })
    await expect(service.install()).rejects.toThrow('尚未就绪')
    updater.emit('update-downloaded', release)
    expect((await service.getState()).status).toBe('ready')
    await service.install()
    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true)
    await expect(service.install()).rejects.toThrow()
  })

  it('allows development builds to download from the configured feed but never install', async () => {
    mocks.packaged = false
    vi.stubEnv('PURECHAT_DESKTOP_UPDATE_URL', 'https://updates.example.com')

    expect((await service.getState()).status).toBe('idle')
    expect(fs.access).toHaveBeenCalledWith('/tmp/purechat-test-app/dev-app-update.yml')
    expect(updater.forceDevUpdateConfig).toBe(true)
    expect(updater.disableDifferentialDownload).toBe(true)
    expect(updater.setFeedURL).toHaveBeenCalledWith({ provider: 'generic', url: 'https://updates.example.com' })

    await service.check()
    await settle()
    expect(updater.downloadUpdate).toHaveBeenCalledOnce()
    updater.emit('update-downloaded', release)
    expect(await service.getState()).toMatchObject({
      message: '更新已下载。开发版本不会安装此更新。',
      progress: 100,
      status: 'downloaded',
    })
    await expect(service.install()).rejects.toThrow('开发版本仅支持下载更新')
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it('deduplicates checks and distinguishes latest from failed checks', async () => {
    let finish!: (value: UpdateCheckResult) => void
    updater.checkForUpdates.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    await Promise.all([service.check(), service.check()])
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    finish(result(false))
    await settle()
    expect((await service.getState()).status).toBe('upToDate')
    updater.checkForUpdates.mockRejectedValue(new Error('offline'))
    await service.check()
    await settle()
    expect((await service.getState()).status).toBe('error')
  })

  it('clears disk and in-memory development cache and allows downloading the same release again', async () => {
    mocks.packaged = false
    vi.stubEnv('PURECHAT_DESKTOP_UPDATE_URL', 'http://127.0.0.1:5500')
    const cacheDir = await fs.mkdtemp(path.join(tmpdir(), 'purechat-update-cache-test-'))
    const helper = new DownloadedUpdateHelper(cacheDir)
    updater.getOrCreateDownloadHelper.mockResolvedValue(helper)
    try {
      const file = path.join(helper.cacheDirForPendingUpdate, 'update.zip')
      await fs.mkdir(helper.cacheDirForPendingUpdate)
      await fs.writeFile(file, 'downloaded installer')
      await fs.writeFile(path.join(cacheDir, 'current.blockmap'), 'cached blockmap')
      await helper.setDownloadedFile(
        file,
        null,
        release,
        { url: new URL('http://127.0.0.1:5500/update.zip'), info: { url: 'update.zip', sha512: 'checksum' } },
        'update.zip',
        true
      )
      expect((await service.getState()).developmentCachePath).toBe(cacheDir)
      await service.check()
      await settle()
      updater.emit('update-downloaded', release)
      expect((await service.getState()).status).toBe('downloaded')

      expect(await service.clearCache()).toMatchObject({
        status: 'idle',
        progress: 0,
        release: null,
        manual: false,
        developmentCachePath: cacheDir,
      })
      expect(helper.file).toBeNull()
      // fs.access is mocked for app config detection; use real stat for cache verification.
      await expect(fs.stat(file)).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(fs.stat(path.join(cacheDir, 'current.blockmap'))).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(fs.stat(path.join(helper.cacheDirForPendingUpdate, 'update-info.json'))).rejects.toMatchObject({
        code: 'ENOENT',
      })
      await service.check()
      await settle()
      expect(updater.downloadUpdate).toHaveBeenCalledTimes(2)
      updater.emit('download-progress', { percent: 35 })
      expect(await service.getState()).toMatchObject({ status: 'downloading', progress: 35 })
    } finally {
      await fs.rm(cacheDir, { recursive: true, force: true })
    }
  })

  it('rejects cache clearing in packaged builds and during an active development download', async () => {
    const remove = vi.spyOn(fs, 'rm').mockResolvedValue(undefined)
    expect((await service.getState()).developmentCachePath).toBeNull()
    await expect(service.clearCache()).rejects.toThrow('仅开发环境')
    expect(remove).not.toHaveBeenCalled()
    service.dispose()
    mocks.packaged = false
    vi.stubEnv('PURECHAT_DESKTOP_UPDATE_URL', 'http://127.0.0.1:5500')
    service = new UpdateService(config as unknown as DesktopConfigService, vi.fn(), updater as unknown as AppUpdater)
    let finish!: () => void
    updater.downloadUpdate.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve
      })
    )
    await service.check()
    await settle()
    await expect(service.clearCache()).rejects.toThrow('请稍后再清理缓存')
    expect(remove).not.toHaveBeenCalled()
    finish()
    await settle()
  })

  it('reports deletion failure without resetting downloaded state, and blocks concurrent checks while clearing', async () => {
    mocks.packaged = false
    vi.stubEnv('PURECHAT_DESKTOP_UPDATE_URL', 'http://127.0.0.1:5500')
    await service.check()
    await settle()
    updater.emit('update-downloaded', release)
    let reject!: (error: Error) => void
    const remove = vi.spyOn(fs, 'rm').mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail
      })
    )
    const clearing = service.clearCache()
    const failure = expect(clearing).rejects.toThrow('permission denied')
    await settle()
    await service.check()
    await expect(service.clearCache()).rejects.toThrow('请稍后再清理缓存')
    await expect(service.setPreferences(preferences)).rejects.toThrow('正在清理更新缓存')
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    reject(new Error('permission denied'))
    await failure
    expect((await service.getState()).status).toBe('downloaded')
    expect(updater.downloadHelper.clear).not.toHaveBeenCalled()
    remove.mockResolvedValueOnce(undefined)
    expect((await service.clearCache()).status).toBe('idle')
    expect(remove).toHaveBeenCalledWith(updater.downloadHelper.cacheDir, { recursive: true, force: true })
  })

  it('cancels and drains the old channel before another check, ignoring its late events', async () => {
    let finishDownload!: () => void
    updater.downloadUpdate.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishDownload = resolve
        })
    )
    await service.check()
    await settle()
    const token = updater.downloadUpdate.mock.calls[0][0]
    await service.setPreferences({ ...preferences, testPlan: true, testChannel: 'beta' })
    expect(token.cancelled).toBe(true)
    updater.emit('download-progress', { percent: 90 })
    updater.emit('update-downloaded', release)
    expect(await service.getState()).toMatchObject({ status: 'idle', progress: 0, release: null })
    await expect(service.install()).rejects.toThrow()
    const nextCheck = service.check()
    await settle()
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    finishDownload()
    await nextCheck
    await settle()
    expect(updater.channel).toBe('beta')
    expect(updater.allowPrerelease).toBe(true)
    expect(updater.allowDowngrade).toBe(false)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2)
  })

  it('does not treat a superseded check result as a current download', async () => {
    let finish!: (value: UpdateCheckResult) => void
    updater.checkForUpdates.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    await service.check()
    await service.setPreferences({ ...preferences, testPlan: true })
    finish(result())
    await settle()
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    expect((await service.getState()).status).toBe('idle')
  })

  it('stops automatic checks while disabled, supports manual checks and resumes when enabled', async () => {
    await service.start()
    await service.setPreferences({ ...preferences, autoUpdate: false })
    await vi.advanceTimersByTimeAsync(20_000)
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    updater.checkForUpdates.mockResolvedValue(result(false))
    await service.check()
    await settle()
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    await service.setPreferences({ ...preferences, autoUpdate: true })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2)
  })

  it('retries failed automatic checks with backoff and removes its subscriptions on dispose', async () => {
    updater.checkForUpdates.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(result(false))
    await service.start()
    await vi.advanceTimersByTimeAsync(5_000)
    expect((await service.getState()).status).toBe('error')
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2)
    service.dispose()
    expect(updater.listenerCount('download-progress')).toBe(0)
    await vi.advanceTimersByTimeAsync(4 * 60 * 60_000)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2)
  })

  it.each(['development', 'development-config', 'portable', 'unconfigured'])(
    'reports %s builds as unsupported',
    async (kind) => {
      if (kind === 'development') {
        mocks.packaged = false
        vi.stubEnv('PURECHAT_DESKTOP_UPDATE_URL', '')
      }
      if (kind === 'portable') {
        Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' })
        vi.stubEnv('PORTABLE_EXECUTABLE_DIR', 'C:\\PureChat')
      }
      if (kind === 'unconfigured') vi.mocked(fs.access).mockRejectedValue(new Error('missing'))
      if (kind === 'development-config') {
        mocks.packaged = false
        vi.stubEnv('PURECHAT_DESKTOP_UPDATE_URL', 'http://127.0.0.1:5500')
        vi.mocked(fs.access).mockRejectedValue(new Error('missing'))
      }
      expect((await service.getState()).status).toBe('unsupported')
      await service.check()
      expect(updater.checkForUpdates).not.toHaveBeenCalled()
    }
  )
})

describe('updater diagnostics', () => {
  it('connects the updater logger and records a failed check with its original error', async () => {
    const error = Object.assign(new Error('Feed unavailable'), { code: 'ECONNREFUSED' })
    updater.checkForUpdates.mockRejectedValue(error)
    await service.check()
    await settle()
    expect(updater.logger).toBe(mocks.logger)
    expect(mocks.logger.info).toHaveBeenCalledWith('Packaged update source', 'http://127.0.0.1:5500/')
    expect(mocks.logger.error).toHaveBeenCalledWith('Update operation failed during checking', error)
    expect(mocks.logger.info).toHaveBeenCalledWith('Scheduling update retry', { delayMs: 300_000, failures: 1 })
    expect((await service.getState()).status).toBe('error')
  })

  it('logs progress once per ten-percent bucket and captures asynchronous installation errors', async () => {
    await service.check()
    await settle()
    for (const percent of [0, 5, 9, 10, 11, 19, 20]) {
      updater.emit('download-progress', { percent, transferred: percent * 10, total: 1000, bytesPerSecond: 100 })
    }
    const progressLogs = mocks.logger.info.mock.calls.filter(([message]) => message === 'Download progress')
    expect(progressLogs).toHaveLength(3)
    updater.emit('update-downloaded', release)
    await service.install()
    const error = Object.assign(new Error('Native installation failed'), { code: 'SIGNATURE_INVALID' })
    updater.emit('error', error)
    expect(mocks.logger.error).toHaveBeenCalledWith('Updater error during installing', error)
    expect(await service.getState()).toMatchObject({
      status: 'error',
      message: '更新包签名校验未通过。请手动安装正式签名版本后再尝试自动更新。',
    })
  })

  it('identifies the native macOS code requirement failure after a successful download', async () => {
    await service.check()
    await settle()
    updater.emit('update-downloaded', release)
    await service.install()
    const error = Object.assign(new Error(
      'Code signature at URL file:///tmp/update/PureChat.app/ did not pass validation: code failed to satisfy specified code requirement(s)'
    ), { code: -1 })
    updater.emit('error', error)
    expect(await service.getState()).toMatchObject({
      status: 'error',
      release: { version: release.version },
      message: '更新包签名校验未通过。请手动安装正式签名版本后再尝试自动更新。',
    })
    expect(mocks.logger.error).toHaveBeenCalledWith('Updater error during installing', error)
  })

  it('reports a synchronous installation failure as an error instead of a network warning', async () => {
    await service.check()
    await settle()
    updater.emit('update-downloaded', release)
    updater.quitAndInstall.mockImplementation(() => { throw new Error('Native installation failed') })
    await expect(service.install()).rejects.toThrow('Native installation failed')
    expect(await service.getState()).toMatchObject({
      status: 'error',
      message: '更新安装失败，请重试或手动安装新版本。',
    })
  })

  it('keeps ordinary download failures distinct from signature failures', async () => {
    await service.check()
    await settle()
    updater.emit('error', Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' }))
    expect(await service.getState()).toMatchObject({
      status: 'error',
      message: '更新失败，请检查网络或更新源后重试。',
    })
  })
})
