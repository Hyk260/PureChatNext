import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { DesktopConfigService, normalizeRemoteServerUrl } from './services/DesktopConfigService'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })))
})

describe('normalizeRemoteServerUrl', () => {
  it('normalizes a valid HTTP(S) origin', () => {
    expect(normalizeRemoteServerUrl(' https://example.com/ ')).toBe('https://example.com')
  })

  it('rejects credentials and unsupported protocols', () => {
    expect(() => normalizeRemoteServerUrl('file:///tmp/app')).toThrow()
    expect(() => normalizeRemoteServerUrl('https://user:pass@example.com')).toThrow()
  })
})

describe('createConfigStore', () => {
  it('persists the remote server without exposing an arbitrary file path', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-desktop-'))
    tempDirs.push(dir)
    const store = new DesktopConfigService(dir)

    await store.write({ remoteServerUrl: 'https://example.com', permissionScopes: {}, secrets: {} })

    expect((await store.read()).remoteServerUrl).toBe('https://example.com')
    expect(await readFile(store.configPath, 'utf8')).toContain('example.com')
  })
})
