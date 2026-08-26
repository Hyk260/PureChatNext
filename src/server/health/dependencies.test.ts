// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  fileEnv: {
    S3_ACCESS_KEY_ID: undefined as string | undefined,
    S3_BUCKET: undefined as string | undefined,
    S3_ENDPOINT: undefined as string | undefined,
    S3_SECRET_ACCESS_KEY: undefined as string | undefined,
  },
  getRedisConfig: vi.fn(),
  initializeRedis: vi.fn(),
  s3CheckConnection: vi.fn(),
  toolsEnv: { SEARXNG_URL: undefined as string | undefined },
}))

vi.mock('@pure/database/core/db-adaptor', () => ({ serverDB: { execute: mocks.execute } }))
vi.mock('@/envs/file', () => ({ fileEnv: mocks.fileEnv }))
vi.mock('@/envs/redis', () => ({ getRedisConfig: mocks.getRedisConfig }))
vi.mock('@/envs/tools', () => ({ toolsEnv: mocks.toolsEnv }))
vi.mock('@/libs/redis', () => ({ initializeRedis: mocks.initializeRedis }))
vi.mock('@/server/modules/S3', () => ({
  FileS3: class {
    checkConnection = mocks.s3CheckConnection
  },
}))

import { checkHealthDependencies, withHealthTimeout } from './dependencies'

describe('health dependency probes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.execute.mockResolvedValue(undefined)
    mocks.getRedisConfig.mockReturnValue({ enabled: false })
    mocks.fileEnv.S3_ACCESS_KEY_ID = undefined
    mocks.fileEnv.S3_BUCKET = undefined
    mocks.fileEnv.S3_ENDPOINT = undefined
    mocks.fileEnv.S3_SECRET_ACCESS_KEY = undefined
    mocks.toolsEnv.SEARXNG_URL = undefined
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports successful configured dependency probes', async () => {
    Object.assign(mocks.fileEnv, {
      S3_ACCESS_KEY_ID: 'access',
      S3_BUCKET: 'bucket',
      S3_ENDPOINT: 'http://rustfs:9000',
      S3_SECRET_ACCESS_KEY: 'secret',
    })
    mocks.getRedisConfig.mockReturnValue({ enabled: true })
    mocks.initializeRedis.mockResolvedValue({ ping: vi.fn().mockResolvedValue('PONG') })
    mocks.s3CheckConnection.mockResolvedValue(undefined)
    mocks.toolsEnv.SEARXNG_URL = 'http://searxng:8080'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    await expect(checkHealthDependencies()).resolves.toEqual({
      database: 'ok',
      redis: 'ok',
      search: 'ok',
      storage: 'ok',
    })
  })

  it('reports unconfigured optional dependencies as skipped', async () => {
    await expect(checkHealthDependencies()).resolves.toEqual({
      database: 'ok',
      redis: 'skipped',
      search: 'skipped',
      storage: 'skipped',
    })
  })

  it('reports partially configured S3 as unhealthy instead of skipped', async () => {
    mocks.fileEnv.S3_ENDPOINT = 'http://rustfs:9000'

    const checks = await checkHealthDependencies()

    expect(checks.storage).toBe('unhealthy')
    expect(mocks.s3CheckConnection).not.toHaveBeenCalled()
  })

  it('passes an abort signal to the S3 probe', async () => {
    let signal: AbortSignal | undefined
    Object.assign(mocks.fileEnv, {
      S3_ACCESS_KEY_ID: 'access',
      S3_BUCKET: 'bucket',
      S3_ENDPOINT: 'http://rustfs:9000',
      S3_SECRET_ACCESS_KEY: 'secret',
    })
    mocks.s3CheckConnection.mockImplementation(async (options: { abortSignal: AbortSignal }) => {
      signal = options.abortSignal
    })

    const checks = await checkHealthDependencies()

    expect(checks.storage).toBe('ok')
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(signal?.aborted).toBe(true)
  })

  it('passes abort signals to both SearXNG health endpoints', async () => {
    mocks.toolsEnv.SEARXNG_URL = 'http://searxng:8080'
    const signals: AbortSignal[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options?: RequestInit) => {
        if (options?.signal) signals.push(options.signal)
        return { ok: false } as Response
      })
    )

    const checks = await checkHealthDependencies()

    expect(checks.search).toBe('unhealthy')
    expect(signals).toHaveLength(2)
    expect(signals.every((signal) => signal.aborted)).toBe(true)
  })

  it('reports dependency exceptions as unhealthy', async () => {
    mocks.execute.mockRejectedValue(new Error('database failed'))
    mocks.getRedisConfig.mockReturnValue({ enabled: true })
    mocks.initializeRedis.mockRejectedValue(new Error('redis failed'))
    Object.assign(mocks.fileEnv, {
      S3_ACCESS_KEY_ID: 'access',
      S3_BUCKET: 'bucket',
      S3_ENDPOINT: 'http://rustfs:9000',
      S3_SECRET_ACCESS_KEY: 'secret',
    })
    mocks.s3CheckConnection.mockRejectedValue(new Error('storage failed'))
    mocks.toolsEnv.SEARXNG_URL = 'http://searxng:8080'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('search failed')))

    await expect(checkHealthDependencies()).resolves.toEqual({
      database: 'unhealthy',
      redis: 'unhealthy',
      search: 'unhealthy',
      storage: 'unhealthy',
    })
  })

  it('aborts a real timeout and exposes it to the probe', async () => {
    let aborted = false
    const started = Date.now()

    await expect(
      withHealthTimeout(
        async (signal) => {
          await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }))
          aborted = signal.aborted
          return 'late'
        },
        { timeoutMs: 20 }
      )
    ).rejects.toThrow('health check timeout')

    expect(aborted).toBe(true)
    expect(Date.now() - started).toBeGreaterThanOrEqual(15)
  })

  it('cancels a probe from its parent signal', async () => {
    const controller = new AbortController()
    const probe = withHealthTimeout(
      (signal) =>
        new Promise<never>((_, reject) =>
          signal.addEventListener('abort', () => reject(new Error('probe stopped')), { once: true })
        ),
      { parentSignal: controller.signal, timeoutMs: 1_000 }
    )
    controller.abort(new Error('health request cancelled'))

    await expect(probe).rejects.toThrow('health request cancelled')
  })

  it('preserves probe exceptions', async () => {
    await expect(
      withHealthTimeout(async () => {
        throw new Error('probe exception')
      })
    ).rejects.toThrow('probe exception')
  })
})
