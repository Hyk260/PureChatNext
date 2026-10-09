// @vitest-environment node

import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ root: '', openPath: vi.fn(), warn: vi.fn() }))
vi.mock('electron', () => ({
  app: { getPath: () => mocks.root, isPackaged: false },
  shell: { openPath: mocks.openPath },
}))
vi.mock('electron-log', () => ({
  default: { transports: { file: {} }, scope: () => ({ warn: mocks.warn }) },
}))

import { DesktopConfigService } from './DesktopConfigService'
import { cleanupLogs, DesktopDataService, isExpiredLog } from './DesktopDataService'

let root: string
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'purechat-data-'))
  mocks.root = root
  mocks.openPath.mockReset().mockResolvedValue('')
  mocks.warn.mockReset()
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  await fs.rm(root, { recursive: true, force: true })
})

const now = new Date(2026, 9, 9, 12)

describe('log retention', () => {
  it('uses calendar dates and keeps the cutoff day, today, future and unrecognized files', () => {
    expect(isExpiredLog('2026-09-08.log', 30, now)).toBe(true)
    expect(isExpiredLog('2026-09-08.old.log', 30, now)).toBe(true)
    for (const name of ['2026-09-09.log', '2026-10-09.log', '2027-01-01.log', '2026-02-30.log', 'notes.log']) {
      expect(isExpiredLog(name, 30, now)).toBe(false)
    }
    expect(isExpiredLog('2020-01-01.log', 0, now)).toBe(false)
  })

  it('removes only expired regular logs without following symlinks or subdirectories', async () => {
    const external = path.join(root, 'external.log')
    await fs.writeFile(external, 'keep')
    await fs.writeFile(path.join(root, '2026-09-08.log'), 'old')
    await fs.writeFile(path.join(root, '2026-09-08.old.log'), 'old')
    await fs.writeFile(path.join(root, '2026-10-09.log'), 'today')
    await fs.symlink(external, path.join(root, '2026-09-01.log'))
    await fs.mkdir(path.join(root, '2026-09-02.log'))
    const onError = vi.fn()
    await cleanupLogs(root, 30, now, onError)
    expect(await fs.readdir(root)).toEqual(
      expect.arrayContaining(['external.log', '2026-10-09.log', '2026-09-01.log', '2026-09-02.log'])
    )
    expect(await fs.readdir(root)).not.toContain('2026-09-08.log')
    expect(await fs.readdir(root)).not.toContain('2026-09-08.old.log')
    expect(await fs.readFile(external, 'utf8')).toBe('keep')
    expect(onError).not.toHaveBeenCalled()
    const link = path.join(root, 'linked-directory')
    await fs.symlink(root, link)
    await cleanupLogs(link, 30, now, onError)
  })

  it('reports deletion failures and retries on the next pass', async () => {
    const file = path.join(root, '2020-01-01.log')
    await fs.writeFile(file, 'old')
    const remove = vi.spyOn(fs, 'unlink').mockRejectedValueOnce(new Error('locked'))
    const onError = vi.fn()
    await cleanupLogs(root, 7, now, onError)
    expect(onError).toHaveBeenCalledOnce()
    expect(await fs.readFile(file, 'utf8')).toBe('old')
    remove.mockRestore()
    await cleanupLogs(root, 7, now, onError)
    await expect(fs.stat(file)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

describe('DesktopDataService', () => {
  function setup() {
    const session = {
      getCacheSize: vi.fn().mockResolvedValue(2048),
      clearCache: vi.fn().mockResolvedValue(undefined),
      clearStorageData: vi.fn(),
    }
    const contents = { isDestroyed: () => false, session }
    const config = new DesktopConfigService(root)
    const service = new DesktopDataService(config, () => contents as unknown as Electron.WebContents)
    return { service, config, session }
  }

  it('returns actual paths and marks a failed cache estimate as unavailable', async () => {
    const { service, session } = setup()
    expect(await service.getInfo()).toEqual({
      dataPath: root,
      logsPath: path.join(root, 'log/dev'),
      logRetentionDays: 30,
      cacheBytes: 2048,
    })
    session.getCacheSize.mockRejectedValueOnce(new Error('unavailable'))
    expect((await service.getInfo()).cacheBytes).toBeNull()
  })

  it('opens only fixed directories and propagates shell errors', async () => {
    const { service } = setup()
    await service.openDirectory('logs')
    expect(mocks.openPath).toHaveBeenCalledWith(path.join(root, 'log/dev'))
    await expect(service.openDirectory('../outside' as never)).rejects.toThrow('数据目录类型无效')
    mocks.openPath.mockResolvedValueOnce('denied')
    await expect(service.openDirectory('data')).rejects.toThrow('denied')
  })

  it('deduplicates cache cleanup, preserves storage and allows retry after failure', async () => {
    const { service, session } = setup()
    let finish: () => void = () => undefined
    session.clearCache.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const first = service.clearHttpCache()
    expect(service.clearHttpCache()).toBe(first)
    expect(session.clearCache).toHaveBeenCalledOnce()
    finish()
    await first
    session.clearCache.mockRejectedValueOnce(new Error('failed'))
    await expect(service.clearHttpCache()).rejects.toThrow('failed')
    await service.clearHttpCache()
    expect(session.clearStorageData).not.toHaveBeenCalled()
  })

  it('validates retention and cleans immediately after saving', async () => {
    const { service, config } = setup()
    const cleanup = vi.spyOn(service, 'cleanup').mockResolvedValue(undefined)
    await expect(service.setLogRetention(10 as never)).rejects.toThrow('日志保留期无效')
    await service.setLogRetention(90)
    expect((await config.read()).logRetentionDays).toBe(90)
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('cleans on startup and every twelve hours, then disposes the timer', async () => {
    const { service } = setup()
    vi.useFakeTimers()
    const cleanup = vi.spyOn(service, 'cleanup').mockResolvedValue(undefined)
    await service.start()
    expect(cleanup).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000)
    expect(cleanup).toHaveBeenCalledTimes(2)
    service.dispose()
    await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000)
    expect(cleanup).toHaveBeenCalledTimes(2)
  })
})
