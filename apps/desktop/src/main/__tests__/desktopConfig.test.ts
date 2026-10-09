import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
}))

import { DesktopConfigService, normalizeRemoteServerUrl } from '../services/DesktopConfigService'

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

describe('DesktopConfigService', () => {
  it('persists the remote server without exposing an arbitrary file path', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-desktop-'))
    tempDirs.push(dir)
    const store = new DesktopConfigService(dir)

    await store.write({
      remoteServerUrl: 'https://example.com',
      permissionScopes: {},
      projects: [],
      secrets: {},
    })

    expect((await store.read()).remoteServerUrl).toBe('https://example.com')
    expect(await readFile(store.configPath, 'utf8')).toContain('example.com')
  })

  it('defaults missing or invalid retention and preserves concurrent configuration updates', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-desktop-'))
    tempDirs.push(dir)
    const store = new DesktopConfigService(dir)
    for (const value of [undefined, -1, '30', 10]) {
      await writeFile(store.configPath, JSON.stringify({ logRetentionDays: value }))
      expect((await store.read()).logRetentionDays).toBe(30)
    }
    await Promise.all([
      store.setLogRetentionDays(7),
      store.setWindowState({ height: 800, width: 1200, isMaximized: false, x: null, y: null }),
      store.createProject({ name: 'Project', rootPath: dir }),
      store.setRemoteServer('https://example.com'),
    ])
    const config = await store.read()
    expect(config.logRetentionDays).toBe(7)
    expect(config.windowState?.width).toBe(1200)
    expect(config.projects).toHaveLength(1)
    expect(config.remoteServerUrl).toBe('https://example.com')
  })

  it('opens legacy config.json and preserves dotted secret keys across restart', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-desktop-'))
    tempDirs.push(dir)
    const configPath = path.join(dir, 'config.json')
    const secret = `safe:${Buffer.from('test-token').toString('base64')}`
    await writeFile(
      configPath,
      JSON.stringify({
        remoteServerUrl: 'https://example.com',
        projects: [{ id: 'existing', name: 'Existing', rootPath: dir, createdAt: 1 }],
        permissionScopes: { topic: [dir] },
        secrets: { 'auth.accessToken': secret },
      })
    )
    const store = new DesktopConfigService(dir)
    expect(store.configPath).toBe(configPath)
    expect(await store.readSecret('auth.accessToken')).toBe('test-token')
    await store.setLogRetentionDays(90)
    await store.storeSecret('auth.refreshToken', 'refresh-token')
    const restarted = new DesktopConfigService(dir)
    const config = await restarted.read()
    expect(config.logRetentionDays).toBe(90)
    expect(config.remoteServerUrl).toBe('https://example.com')
    expect(config.projects[0]?.id).toBe('existing')
    expect(config.permissionScopes.topic).toEqual([dir])
    expect(config.secrets['auth.accessToken']).toBe(secret)
    expect(await restarted.readSecret('auth.refreshToken')).toBe('refresh-token')
    expect(config.secrets).not.toHaveProperty('auth')
  })

  it('keeps a corrupt config file intact instead of silently resetting it', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-desktop-'))
    tempDirs.push(dir)
    const configPath = path.join(dir, 'config.json')
    await writeFile(configPath, '{corrupt')
    expect(() => new DesktopConfigService(dir)).toThrow()
    expect(await readFile(configPath, 'utf8')).toBe('{corrupt')
  })

  it('persists and clamps window state', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-desktop-'))
    tempDirs.push(dir)
    const store = new DesktopConfigService(dir)

    await store.setWindowState({ height: 10, isMaximized: true, width: 10_000, x: 12.4, y: -8.8 })

    expect((await store.read()).windowState).toEqual({
      height: 520,
      isMaximized: true,
      width: 3840,
      x: 12,
      y: -9,
    })
  })

  it('creates and lists desktop projects', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-desktop-'))
    tempDirs.push(dir)
    const store = new DesktopConfigService(dir)
    const rootPath = path.join(dir, 'workspace')

    const project = await store.createProject({ name: ' Demo ', rootPath })

    expect(project.name).toBe('Demo')
    expect(project.rootPath).toBe(path.resolve(rootPath))
    expect(await store.listProjects()).toEqual([project])
    await store.deleteProject(project.id)
    expect(await store.listProjects()).toEqual([])
  })
})
