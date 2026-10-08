// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getAppPath: () => '/repo',
    getPath: (name: string) =>
      ({ exe: '/Applications/PureChat.app/Contents/MacOS/PureChat', temp: '/tmp', userData: '/user-data' })[name],
    isPackaged: false,
  },
}))

import {
  getAppConfigDir,
  getCacheDir,
  getConfigDir,
  getFileDir,
  getFileName,
  getFilesDir,
  getInstallPath,
  getMcpDir,
  getResourcePath,
  getTempDir,
  readTextFileWithAutoEncoding,
} from '../utils/file'

describe('desktop file utilities', () => {
  it('resolves shared application paths', () => {
    expect(getInstallPath()).toBe('/Applications/PureChat.app/Contents/MacOS')
    expect(getFileDir('/tmp/example.txt')).toBe('/tmp')
    expect(getFileName('/tmp/example.txt')).toBe('example.txt')
    expect(getTempDir()).toBe('/tmp/PureChat')
    expect(getFilesDir()).toBe('/user-data/Data/Files')
    expect(getCacheDir()).toBe('/user-data/Cache')
    expect(getMcpDir()).toBe(path.join(os.homedir(), '.purechat', 'mcp'))
    expect(getConfigDir()).toBe(path.join(os.homedir(), '.purechat', 'config'))
    expect(getAppConfigDir('desktop')).toBe(path.join(os.homedir(), '.purechat', 'config', 'desktop'))
  })

  it('resolves development resources and rejects paths outside the root', () => {
    expect(getResourcePath('tray.png', { developmentRoot: '/repo/apps/desktop/build' })).toBe(
      '/repo/apps/desktop/build/tray.png'
    )
    expect(getResourcePath('../secret.txt', { developmentRoot: '/repo/apps/desktop/build' })).toBeNull()
  })

  it('reads UTF-8 and UTF-16 files', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'purechat-file-'))
    try {
      const utf8Path = path.join(tempDir, 'utf8.txt')
      const utf16Path = path.join(tempDir, 'utf16.txt')
      const utf16NoBomPath = path.join(tempDir, 'utf16-no-bom.txt')
      await writeFile(utf8Path, '纯文本')
      await writeFile(utf16Path, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('UTF-16', 'utf16le')]))
      await writeFile(utf16NoBomPath, Buffer.from('无 BOM', 'utf16le'))

      await expect(readTextFileWithAutoEncoding(utf8Path)).resolves.toBe('纯文本')
      await expect(readTextFileWithAutoEncoding(utf16Path)).resolves.toBe('UTF-16')
      await expect(readTextFileWithAutoEncoding(utf16NoBomPath)).resolves.toBe('无 BOM')
    } finally {
      await rm(tempDir, { force: true, recursive: true })
    }
  })
})
