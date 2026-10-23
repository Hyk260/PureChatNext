// @vitest-environment node
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { verifyTerminalRuntime } from './terminal-runtime.mjs'

let root
let binary
let helper
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'terminal-package-'))
  const scope = path.join(root, 'node_modules/@lydell')
  const prebuild = path.join(scope, 'node-pty-darwin-arm64/prebuilds/darwin-arm64')
  await mkdir(prebuild, { recursive: true })
  await mkdir(path.join(scope, 'node-pty'))
  await writeFile(path.join(scope, 'node-pty/index.js'), 'module.exports = {}')
  binary = path.join(prebuild, 'pty.node')
  helper = path.join(prebuild, 'spawn-helper')
  const header = Buffer.alloc(8)
  header.writeUInt32LE(0xfeedfacf, 0)
  header.writeUInt32LE(0x0100000c, 4)
  await writeFile(binary, header)
  await writeFile(helper, '#!/bin/sh\n', { mode: 0o755 })
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('terminal native package resources', () => {
  it('accepts the expected architecture with an executable helper', async () => {
    await expect(verifyTerminalRuntime(root, 'arm64')).resolves.toBeUndefined()
  })

  it('rejects the wrong native architecture', async () => {
    const header = Buffer.alloc(8)
    header.writeUInt32LE(0x01000007, 4)
    await writeFile(binary, header)
    await expect(verifyTerminalRuntime(root, 'arm64')).rejects.toThrow('架构错误')
  })

  it('rejects missing helper and wrapper resources', async () => {
    await rm(helper)
    await expect(verifyTerminalRuntime(root, 'arm64')).rejects.toThrow()
    await writeFile(helper, '#!/bin/sh\n', { mode: 0o755 })
    await rm(path.join(root, 'node_modules/@lydell/node-pty/index.js'))
    await expect(verifyTerminalRuntime(root, 'arm64')).rejects.toThrow()
  })

  it.skipIf(process.platform === 'win32')('rejects helpers without execute permission', async () => {
    await chmod(helper, 0o644)
    await expect(verifyTerminalRuntime(root, 'arm64')).rejects.toThrow()
  })
})
