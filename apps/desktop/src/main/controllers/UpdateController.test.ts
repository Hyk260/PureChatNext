import { afterEach, describe, expect, it, vi } from 'vitest'

const ipc = vi.hoisted(() => ({ handle: vi.fn(), removeHandler: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: ipc }))

import { IpcRegistry } from '../ipc/IpcRegistry'
import type { UpdateService } from '../services/UpdateService'
import { UpdateController } from './UpdateController'

type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>
afterEach(() => vi.clearAllMocks())

describe('update IPC boundary', () => {
  it('allows only the trusted renderer main frame to check, clear cache, install and change settings', async () => {
    const frame = { url: 'purechat://renderer/settings/about' }
    const contents = { mainFrame: frame, isDestroyed: () => false }
    const service = {
      getState: vi.fn(),
      getLogs: vi.fn().mockResolvedValue({ text: 'desktop:update log', truncated: false }),
      clearLogs: vi.fn(),
      check: vi.fn(),
      clearCache: vi.fn(),
      install: vi.fn(),
      setPreferences: vi.fn(),
    }
    const registry = new IpcRegistry(() => contents as unknown as Electron.WebContents, 'purechat://renderer')
    new UpdateController(service as unknown as UpdateService).register(registry)
    const handlers = new Map<string, Handler>(ipc.handle.mock.calls.map(([name, handler]) => [name, handler]))
    for (const channel of ['updater.getLogs', 'updater.clearLogs', 'updater.check', 'updater.clearCache', 'updater.install', 'updater.setPreferences']) {
      const handler = handlers.get(channel)!
      const rejected = await handler({ sender: contents, senderFrame: { url: 'https://example.com' } })
      expect(rejected).toMatchObject({ __pureChatIpcError: true })
    }
    expect(service.check).not.toHaveBeenCalled()
    expect(service.getLogs).not.toHaveBeenCalled()
    expect(service.clearLogs).not.toHaveBeenCalled()
    expect(service.clearCache).not.toHaveBeenCalled()
    expect(service.install).not.toHaveBeenCalled()
    expect(service.setPreferences).not.toHaveBeenCalled()
    await handlers.get('updater.check')!({ sender: contents, senderFrame: frame })
    expect(service.check).toHaveBeenCalledTimes(1)
    await handlers.get('updater.clearCache')!({ sender: contents, senderFrame: frame })
    expect(service.clearCache).toHaveBeenCalledOnce()
    expect(await handlers.get('updater.getLogs')!({ sender: contents, senderFrame: frame })).toEqual({
      text: 'desktop:update log', truncated: false,
    })
    expect(service.getLogs).toHaveBeenCalledOnce()
    await handlers.get('updater.clearLogs')!({ sender: contents, senderFrame: frame })
    expect(service.clearLogs).toHaveBeenCalledOnce()
    registry.unregisterAll()
    expect(ipc.removeHandler).toHaveBeenCalledTimes(7)
  })
})
