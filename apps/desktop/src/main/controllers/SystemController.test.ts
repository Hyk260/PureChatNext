import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => ({ handle: vi.fn(), removeHandler: vi.fn(), openPath: vi.fn() }))
vi.mock('electron', () => ({
  app: { isPackaged: false, getVersion: () => 'test' },
  ipcMain: { handle: electron.handle, removeHandler: electron.removeHandler },
  Notification: vi.fn(),
  shell: { openPath: electron.openPath },
}))

import { IpcRegistry } from '../ipc/IpcRegistry'
import { SystemController } from './SystemController'

type Handler = (event: unknown, targetPath: string) => Promise<unknown>
const temporaryDirectories: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { force: true, recursive: true }))
  )
})

async function setupOpenPath() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'purechat-open-path-'))
  temporaryDirectories.push(directory)
  const frame = { url: 'purechat://renderer/chat' }
  const contents = { mainFrame: frame, isDestroyed: () => false }
  const registry = new IpcRegistry(() => contents as unknown as Electron.WebContents, 'purechat://renderer')
  new SystemController().register(registry)
  const handlers = new Map<string, Handler>(electron.handle.mock.calls.map(([name, handler]) => [name, handler]))
  electron.openPath.mockResolvedValue('')
  return {
    directory,
    handler: handlers.get('shell.openPath')!,
    event: { sender: contents, senderFrame: frame },
  }
}

describe('system open-path IPC', () => {
  it('opens both a file and a directory through their canonical paths', async () => {
    const { directory, event, handler } = await setupOpenPath()
    const file = path.join(directory, '.editorconfig')
    await fs.writeFile(file, 'root = true')
    expect(await handler(event, file)).toBeUndefined()
    expect(electron.openPath).toHaveBeenLastCalledWith(await fs.realpath(file))
    expect(await handler(event, directory)).toBeUndefined()
    expect(electron.openPath).toHaveBeenLastCalledWith(await fs.realpath(directory))
  })

  it('rejects relative, missing and sensitive paths before calling the operating system', async () => {
    const { directory, event, handler } = await setupOpenPath()
    expect(await handler(event, 'relative.txt')).toMatchObject({ __pureChatIpcError: true })
    expect(await handler(event, path.join(directory, 'missing.txt'))).toMatchObject({ __pureChatIpcError: true })
    const directoryStat = await fs.stat(directory)
    vi.spyOn(fs, 'realpath').mockResolvedValue('/private/etc')
    vi.spyOn(fs, 'stat').mockResolvedValue(directoryStat)
    expect(await handler(event, directory)).toMatchObject({
      __pureChatIpcError: true,
      message: '访问系统敏感目录被拒绝',
    })
    expect(electron.openPath).not.toHaveBeenCalled()
  })

  it('keeps sender validation and reports errors returned by the system shell', async () => {
    const { directory, event, handler } = await setupOpenPath()
    const untrusted = { ...event, senderFrame: { url: 'https://example.com' } }
    expect(await handler(untrusted, directory)).toMatchObject({ __pureChatIpcError: true })
    expect(electron.openPath).not.toHaveBeenCalled()
    electron.openPath.mockResolvedValue('未找到可用的默认应用')
    expect(await handler(event, directory)).toMatchObject({
      __pureChatIpcError: true,
      message: '未找到可用的默认应用',
    })
  })
})
