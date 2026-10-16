// @vitest-environment node
import childProcess from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { exportPackImage, parsePackCompressor } from './docker-pack'

const originalSpawn = childProcess.spawn
const originalSpawnSync = childProcess.spawnSync

describe('Docker image export', () => {
  let directory: string
  let payload: string
  let imageId: string
  let dockerExit: number
  let pigzAvailable: boolean
  let pigzExit: number
  let commands: string[]

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'purechat-pack-test-'))
    payload = 'image archive v1'
    imageId = 'sha256:first'
    dockerExit = 0
    pigzAvailable = false
    pigzExit = 0
    commands = []
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(childProcess, 'spawnSync').mockImplementation((program, _args, options) => {
      const script =
        program === 'pigz'
          ? `process.exit(${pigzAvailable ? 0 : 1})`
          : `process.stdout.write(${JSON.stringify(imageId)})`
      return originalSpawnSync(process.execPath, ['-e', script], options)
    })
    vi.spyOn(childProcess, 'spawn').mockImplementation((program, _args, options) => {
      commands.push(program)
      const script =
        program === 'docker'
          ? `process.stdout.write(${JSON.stringify(payload)}); process.exitCode = ${dockerExit}`
          : `if (${pigzExit}) process.exit(${pigzExit}); process.stdin.pipe(require('node:zlib').createGzip({level: 1})).pipe(process.stdout)`
      return originalSpawn(process.execPath, ['-e', script], options)
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(directory, { recursive: true, force: true })
  })

  const exportTo = (name: string, overrides: Partial<Parameters<typeof exportPackImage>[0]> = {}) =>
    exportPackImage({
      cacheDir: path.join(directory, 'cache'),
      compressor: 'auto',
      cwd: directory,
      destFile: path.join(directory, name, 'image.tar.gz'),
      image: 'purechat-next:local',
      imageId,
      platform: 'linux/amd64',
      useCache: true,
      ...overrides,
    })

  const readImage = async (name: string) =>
    gunzipSync(await readFile(path.join(directory, name, 'image.tar.gz'))).toString()

  it('falls back to gzip and reuses the exact image without exporting again', async () => {
    expect(await exportTo('first')).toEqual({ cacheHit: false })
    expect(await readImage('first')).toBe(payload)
    payload = 'must not be exported'
    expect(await exportTo('second')).toEqual({ cacheHit: true })
    expect(await readImage('second')).toBe('image archive v1')
    expect(commands).toEqual(['docker'])
  })

  it('invalidates changed image IDs, keeps previous staging data, and prunes old cache', async () => {
    await exportTo('first')
    imageId = 'sha256:second'
    payload = 'image archive v2'
    expect(await exportTo('second')).toEqual({ cacheHit: false })
    expect(await readImage('second')).toBe(payload)
    expect(await readImage('first')).toBe('image archive v1')
    expect(await readdir(path.join(directory, 'cache/linux-amd64'))).toHaveLength(1)
  })

  it('separates platforms and image tags even with the same image ID', async () => {
    await exportTo('first')
    expect(await exportTo('arm', { platform: 'linux/arm64' })).toEqual({ cacheHit: false })
    expect(await exportTo('tag', { image: 'purechat-next:other' })).toEqual({ cacheHit: false })
    expect(commands).toEqual(['docker', 'docker', 'docker'])
  })

  it('can force an export while preserving previously linked archives', async () => {
    await exportTo('first')
    payload = 'fresh export'
    expect(await exportTo('forced', { useCache: false })).toEqual({ cacheHit: false })
    expect(await readImage('forced')).toBe(payload)
    expect(await readImage('first')).toBe('image archive v1')
  })

  it('uses pigz when available and produces compatible gzip data', async () => {
    pigzAvailable = true
    await exportTo('pigz')
    expect(commands).toEqual(['docker', 'pigz'])
    expect(await readImage('pigz')).toBe(payload)
  })

  it('preserves a good cache and removes temporary files when docker save fails', async () => {
    await exportTo('first')
    dockerExit = 7
    await expect(exportTo('failed', { useCache: false })).rejects.toThrow('docker save 失败')
    expect(await readdir(path.join(directory, 'cache/linux-amd64'))).toHaveLength(1)
    expect(await exportTo('retry')).toEqual({ cacheHit: true })
    expect(await readImage('retry')).toBe('image archive v1')
  })

  it('does not cache data when pigz fails', async () => {
    pigzAvailable = true
    pigzExit = 9
    await expect(exportTo('failed')).rejects.toThrow()
    expect(await readdir(path.join(directory, 'cache/linux-amd64'))).toEqual([])
  })

  it('handles a command startup failure and removes the partial export', async () => {
    vi.mocked(childProcess.spawn).mockImplementationOnce((_program, _args, options) =>
      originalSpawn(path.join(directory, 'missing-docker-command'), [], options)
    )
    await expect(exportTo('missing-command')).rejects.toThrow('ENOENT')
    expect(await readdir(path.join(directory, 'cache/linux-amd64'))).toEqual([])
  })

  it('rejects an image tag changed during export', async () => {
    await expect(exportTo('changed', { imageId: 'sha256:old' })).rejects.toThrow('在导出期间发生变化')
    expect(await readdir(path.join(directory, 'cache/linux-amd64'))).toEqual([])
  })

  it('reports an explicitly requested but unavailable pigz', async () => {
    await expect(exportTo('missing', { compressor: 'pigz' })).rejects.toThrow('未检测到 pigz')
    expect(commands).toEqual([])
  })
})

it('rejects unsupported compressors', () => {
  expect(parsePackCompressor()).toBe('auto')
  expect(() => parsePackCompressor('zstd')).toThrow('--compressor')
})
