// @vitest-environment node
import { mkdtemp, mkdir, rm, truncate, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { createPackage, uncache } from '@electron/asar'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { MAX_ASAR_BYTES, verifyPackage } from './verify-package.mjs'

describe('desktop package contract', () => {
  let tempDir
  let sourceDir
  let archive

  const write = async (name, content = 'fixture') => {
    const file = path.join(sourceDir, name)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, content)
  }
  const pack = () => createPackage(sourceDir, archive)

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'purechat-package-'))
    sourceDir = path.join(tempDir, 'source')
    archive = path.join(tempDir, 'app.asar')
    for (const name of ['package.json', 'dist/main/index.js', 'dist/preload/index.cjs', 'dist/renderer/index.html', 'dist/renderer/assets/app.css']) {
      await write(name)
    }
  })

  afterEach(async () => {
    uncache(archive)
    await rm(tempDir, { recursive: true, force: true })
  })

  it('accepts the bundled runtime without node_modules', async () => {
    await pack()
    expect((await verifyPackage(archive)).bytes).toBeLessThan(MAX_ASAR_BYTES)
  })

  it.each(['node_modules/next/index.js', 'dist/node_modules/next/index.js', 'dist/renderer/.env.local', 'dist/main/index.js.map', 'src/main.ts'])('rejects unexpected content: %s', async (name) => {
    await write(name)
    await pack()
    await expect(verifyPackage(archive)).rejects.toThrow('非运行时文件')
  })

  it('rejects a missing preload entry', async () => {
    await rm(path.join(sourceDir, 'dist/preload/index.cjs'))
    await pack()
    await expect(verifyPackage(archive)).rejects.toThrow('缺少入口')
  })

  it('rejects missing styles', async () => {
    await rm(path.join(sourceDir, 'dist/renderer/assets/app.css'))
    await pack()
    await expect(verifyPackage(archive)).rejects.toThrow('缺少渲染样式')
  })

  it('rejects archive size growth beyond the budget', async () => {
    await pack()
    await truncate(archive, MAX_ASAR_BYTES + 1)
    await expect(verifyPackage(archive)).rejects.toThrow('超出 64 MiB')
  })
})
