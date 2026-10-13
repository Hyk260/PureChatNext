// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { copyFile, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { syncDesktopVersion } from './sync-version.mjs'

const desktopSourceDir = fileURLToPath(new URL('../', import.meta.url))

describe('desktop version source', () => {
  let rootDir
  let desktopDir
  const manifest = { name: 'purechat-desktop', version: '0.2.1', main: './dist/main/index.js', private: true }

  beforeEach(async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'purechat-desktop-version-'))
    desktopDir = path.join(rootDir, 'apps/desktop')
    await mkdir(desktopDir, { recursive: true })
    await writeFile(path.join(desktopDir, 'package.json'), JSON.stringify(manifest))
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it.each(['0.3.0', '0.4.0-rc.1', '0.4.0-beta.2'])(
    'synchronizes %s and preserves other desktop fields',
    async (version) => {
      await writeFile(path.join(rootDir, 'package.json'), JSON.stringify({ version }))
      expect(syncDesktopVersion(desktopDir)).toBe(version)
      expect(JSON.parse(await readFile(path.join(desktopDir, 'package.json'), 'utf8'))).toEqual({
        ...manifest,
        version,
      })
    }
  )

  it('reads subsequent root releases and does not rewrite an already synchronized manifest', async () => {
    const rootManifest = path.join(rootDir, 'package.json')
    const desktopManifest = path.join(desktopDir, 'package.json')
    await writeFile(rootManifest, JSON.stringify({ version: manifest.version }))
    const original = await readFile(desktopManifest, 'utf8')
    syncDesktopVersion(desktopDir)
    expect(await readFile(desktopManifest, 'utf8')).toBe(original)

    await writeFile(rootManifest, JSON.stringify({ version: '0.3.1' }))
    expect(syncDesktopVersion(desktopDir)).toBe('0.3.1')
    expect(JSON.parse(await readFile(desktopManifest, 'utf8')).version).toBe('0.3.1')
  })

  it.each([
    { updateUrl: '', publish: [{ provider: 'github', owner: 'Hyk260', repo: 'PureChatNext' }] },
    { updateUrl: 'http://127.0.0.1:5500', publish: [{ provider: 'generic', url: 'http://127.0.0.1:5500' }] },
  ])(
    'validates the builder version, channel and publish config with update URL "$updateUrl"',
    async ({ updateUrl, publish }) => {
      await writeFile(path.join(rootDir, 'package.json'), JSON.stringify({ version: '0.4.0-rc.1' }))
      await copyFile(path.join(desktopSourceDir, 'electron-builder.mjs'), path.join(desktopDir, 'electron-builder.mjs'))
      await symlink(path.join(desktopSourceDir, 'scripts'), path.join(desktopDir, 'scripts'), 'junction')
      await symlink(path.join(desktopSourceDir, 'node_modules'), path.join(desktopDir, 'node_modules'), 'junction')
      await symlink(
        path.resolve(desktopSourceDir, '../../node_modules'),
        path.join(rootDir, 'node_modules'),
        'junction'
      )
      const output = execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `
      import { createRequire } from 'node:module'
      const require = createRequire(import.meta.url)
      const builderRequire = createRequire(require.resolve('electron-builder'))
      const { Packager } = builderRequire('app-builder-lib')
      const { AppInfo } = builderRequire('app-builder-lib/out/appInfo')
      const packager = new Packager({ projectDir: process.cwd(), config: 'electron-builder.mjs' })
      await packager.validateConfig()
      const info = new AppInfo(packager)
      console.log('VERSION_RESULT ' + JSON.stringify({ version: info.version, channel: info.channel, publish: packager.config.publish }))
    `,
        ],
        {
          cwd: desktopDir,
          encoding: 'utf8',
          timeout: 10_000,
          env: { ...process.env, PURECHAT_DESKTOP_UPDATE_URL: updateUrl },
        }
      )
      const result = output.split('\n').find((line) => line.startsWith('VERSION_RESULT '))
      expect(JSON.parse(result.slice('VERSION_RESULT '.length))).toEqual({
        version: '0.4.0-rc.1',
        channel: 'rc',
        publish,
      })
      expect(JSON.parse(await readFile(path.join(desktopDir, 'package.json'), 'utf8')).version).toBe('0.4.0-rc.1')
    }
  )
})
