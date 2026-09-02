import { afterEach, describe, expect, it, vi } from 'vitest'

import { SystemToolsService } from './SystemToolsService'

type ExecResult = { stdout: string; stderr: string }

describe('SystemToolsService', () => {
  const originalPlatform = process.platform

  afterEach(() => {
    Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform })
    vi.restoreAllMocks()
  })

  it('returns builtin tools from process.versions', () => {
    const service = new SystemToolsService(async () => ({ stdout: '', stderr: '' }))
    const builtin = service.getBuiltinTools()

    expect(builtin.map((item) => item.id)).toEqual(['electron', 'chromium', 'node'])
    expect(builtin.find((item) => item.id === 'node')?.version).toBe(process.versions.node)
    expect(builtin.find((item) => item.id === 'chromium')?.name).toBe('Chromium')
  })

  it('detects runtime tools with which and version output', async () => {
    Object.defineProperty(process, 'platform', { configurable: true, value: 'darwin' })

    const execFileFn = vi.fn(async (file: string, args: readonly string[]): Promise<ExecResult> => {
      if (file === 'which') {
        const name = args[0]
        if (name === 'node') return { stdout: '/usr/local/bin/node\n', stderr: '' }
        if (name === 'python3') return { stdout: '/usr/bin/python3\n', stderr: '' }
        throw Object.assign(new Error('not found'), { code: 1, stdout: '', stderr: '' })
      }
      if (file === '/usr/local/bin/node') return { stdout: 'v22.13.1\n', stderr: '' }
      if (file === '/usr/bin/python3') return { stdout: 'Python 3.12.8\n', stderr: '' }
      throw Object.assign(new Error('not found'), { code: 1, stdout: '', stderr: '' })
    })

    const service = new SystemToolsService(execFileFn)
    const runtime = await service.getRuntimeTools()

    const node = runtime.find((item) => item.id === 'node')
    const python = runtime.find((item) => item.id === 'python')
    const bun = runtime.find((item) => item.id === 'bun')

    expect(node).toMatchObject({
      available: true,
      name: 'node',
      path: '/usr/local/bin/node',
      version: 'v22.13.1',
    })
    expect(python).toMatchObject({
      available: true,
      name: 'python',
      path: '/usr/bin/python3',
      version: 'Python 3.12.8',
    })
    expect(bun).toMatchObject({ available: false, path: null, version: null })
    expect(execFileFn).toHaveBeenCalledWith('which', ['node'], expect.any(Object))
  })

  it('uses where on Windows and takes the first path line', async () => {
    Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' })

    const execFileFn = vi.fn(async (file: string, args: readonly string[]): Promise<ExecResult> => {
      if (file === 'where' && args[0] === 'npm') {
        return { stdout: 'C:\\Program Files\\nodejs\\npm.cmd\nC:\\Users\\me\\npm.cmd\n', stderr: '' }
      }
      if (file === 'C:\\Program Files\\nodejs\\npm.cmd') return { stdout: '10.9.2\n', stderr: '' }
      throw Object.assign(new Error('not found'), { code: 1, stdout: '', stderr: '' })
    })

    const service = new SystemToolsService(execFileFn)
    const runtime = await service.getRuntimeTools()
    const npm = runtime.find((item) => item.id === 'npm')

    expect(npm).toMatchObject({
      available: true,
      path: 'C:\\Program Files\\nodejs\\npm.cmd',
      version: '10.9.2',
    })
    expect(execFileFn).toHaveBeenCalledWith('where', ['npm'], expect.any(Object))
  })

  it('reads version from stderr when command exits non-zero', async () => {
    Object.defineProperty(process, 'platform', { configurable: true, value: 'linux' })

    const execFileFn = vi.fn(async (file: string, args: readonly string[]): Promise<ExecResult> => {
      if (file === 'which' && args[0] === 'uv') return { stdout: '/home/me/.local/bin/uv\n', stderr: '' }
      if (file === '/home/me/.local/bin/uv') {
        throw Object.assign(new Error('nonzero'), {
          code: 0,
          stderr: 'uv 0.12.3 (507230998 2026-08-07 aarch64-apple-darwin)\n',
          stdout: '',
        })
      }
      throw Object.assign(new Error('not found'), { code: 1, stdout: '', stderr: '' })
    })

    const service = new SystemToolsService(execFileFn)
    const runtime = await service.getRuntimeTools()
    const uv = runtime.find((item) => item.id === 'uv')

    expect(uv?.available).toBe(true)
    expect(uv?.version).toContain('uv 0.12.3')
  })

  it('aggregates builtin and runtime in getSystemTools', async () => {
    const execFileFn = vi.fn(async () => {
      throw Object.assign(new Error('not found'), { code: 1, stdout: '', stderr: '' })
    })
    const service = new SystemToolsService(execFileFn)
    const result = await service.getSystemTools()

    expect(result.builtin).toHaveLength(3)
    expect(result.runtime).toHaveLength(7)
    expect(result.runtime.every((item) => item.available === false)).toBe(true)
  })
})
