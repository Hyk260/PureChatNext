import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { DEFAULT_CONFIG, DesktopConfigService, normalizeRemoteServerUrl } from '../services/DesktopConfigService'
import { DEFAULT_UPDATE_PREFERENCES } from '@/types/desktopUpdater'
import type { DesktopUpdatePreferences } from '@/types/desktopUpdater'

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
  it('encrypts the config file and persists secrets across restart', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-desktop-'))
    tempDirs.push(dir)
    const store = new DesktopConfigService(dir)

    await store.storeSecret('auth.accessToken', 'access-token')

    expect(await store.readSecret('auth.accessToken')).toBe('access-token')
    expect(await readFile(store.configPath, 'utf8')).not.toContain('access-token')
    expect(await new DesktopConfigService(dir).readSecret('auth.accessToken')).toBe('access-token')
  })

  it('validates and persists update preferences without losing concurrent configuration writes', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-update-config-'))
    tempDirs.push(dir)
    const store = new DesktopConfigService(dir)
    expect((await store.read()).updatePreferences).toEqual(DEFAULT_UPDATE_PREFERENCES)
    const preferences: DesktopUpdatePreferences = { autoUpdate: false, testPlan: true, testChannel: 'beta' }
    await Promise.all([store.setUpdatePreferences(preferences), store.setLogRetentionDays(7)])
    const restarted = new DesktopConfigService(dir)
    expect((await restarted.read()).updatePreferences).toEqual(preferences)
    expect((await restarted.read()).logRetentionDays).toBe(7)
    const invalid = { ...preferences, testChannel: 'nightly' } as unknown as DesktopUpdatePreferences
    await expect(restarted.setUpdatePreferences(invalid)).rejects.toThrow('更新设置无效')
    expect((await restarted.read()).updatePreferences).toEqual(preferences)
  })
  it('restores a saved update source and retained custom URL across restart', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-update-source-'))
    tempDirs.push(dir)
    const store = new DesktopConfigService(dir)
    const preferences: DesktopUpdatePreferences = {
      autoUpdate: false, testPlan: true, testChannel: 'beta', updateSource: 'github',
      customUpdateUrl: ' https://cdn.example.com/desktop/ ',
    }
    await store.setUpdatePreferences(preferences)
    expect((await new DesktopConfigService(dir).read()).updatePreferences).toEqual({
      ...preferences, customUpdateUrl: 'https://cdn.example.com/desktop/',
    })
    await expect(store.setUpdatePreferences({ ...preferences, updateSource: 'custom', customUpdateUrl: '' }))
      .rejects.toThrow('更新设置无效')
    expect((await store.read()).updatePreferences?.updateSource).toBe('github')
  })

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
    expect(await readFile(store.configPath, 'utf8')).not.toContain('example.com')
  })

  it('defaults missing or invalid retention and preserves concurrent configuration updates', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-desktop-'))
    tempDirs.push(dir)
    const store = new DesktopConfigService(dir)
    for (const value of [undefined, -1, '30', 10]) {
      await store.write({ ...DEFAULT_CONFIG, logRetentionDays: value as never })
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

  it('keeps a corrupt config file intact instead of silently resetting it', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-desktop-'))
    tempDirs.push(dir)
    const store = new DesktopConfigService(dir)
    const configPath = store.configPath
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
