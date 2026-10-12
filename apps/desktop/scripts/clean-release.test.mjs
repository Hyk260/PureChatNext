// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { copyFile, mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cleanRelease } from './clean-release.mjs'

describe('desktop release cleanup', () => {
  let fixtureDir
  let releaseDir

  beforeEach(async () => {
    fixtureDir = await realpath(await mkdtemp(path.join(tmpdir(), 'purechat-clean-release-')))
    releaseDir = path.join(fixtureDir, 'release')
    await mkdir(path.join(releaseDir, 'mac-arm64'), { recursive: true })
    await writeFile(path.join(releaseDir, 'PureChat-0.2.0-arm64.zip'), 'old installer')
    await writeFile(path.join(releaseDir, 'latest-mac.yml'), 'old metadata')
    await writeFile(path.join(releaseDir, 'mac-arm64/app.asar'), 'old application')
    await writeFile(path.join(fixtureDir, 'keep.txt'), 'outside release')
  })

  afterEach(async () => {
    await rm(fixtureDir, { recursive: true, force: true })
  })

  it('removes artifacts and unpacked directories without following links outside release', async () => {
    await mkdir(path.join(fixtureDir, 'dist'))
    await writeFile(path.join(fixtureDir, 'dist/main.js'), 'compiled source')
    await symlink(path.join(fixtureDir, 'dist'), path.join(releaseDir, 'linked-dist'), 'junction')
    await cleanRelease(releaseDir)
    expect(await readdir(releaseDir)).toEqual([])
    expect(await readFile(path.join(fixtureDir, 'keep.txt'), 'utf8')).toBe('outside release')
    expect(await readFile(path.join(fixtureDir, 'dist/main.js'), 'utf8')).toBe('compiled source')
  })

  it('handles a missing release directory and repeated cleanup', async () => {
    await rm(releaseDir, { recursive: true })
    await cleanRelease(releaseDir)
    await cleanRelease(releaseDir)
    expect(await readdir(releaseDir)).toEqual([])
  })

  it('resolves the release directory from the script location, independent of cwd', async () => {
    const scriptsDir = path.join(fixtureDir, 'scripts')
    await mkdir(scriptsDir)
    const script = path.join(scriptsDir, 'clean-release.mjs')
    await copyFile(fileURLToPath(new URL('./clean-release.mjs', import.meta.url)), script)
    execFileSync(process.execPath, [script], { cwd: tmpdir() })
    expect(await readdir(releaseDir)).toEqual([])
    expect(await readFile(path.join(fixtureDir, 'keep.txt'), 'utf8')).toBe('outside release')
  })
})
