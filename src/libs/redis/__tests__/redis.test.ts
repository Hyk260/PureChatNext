import { afterEach, describe, expect, it, vi } from 'vitest'

import type { RedisConfig } from '../types'

const buildRedisConfig = (): RedisConfig | null => {
  const url = process.env.REDIS_URL

  if (!url) return null

  const database = Number.parseInt(process.env.REDIS_DATABASE ?? '', 10)

  return {
    database: Number.isNaN(database) ? undefined : database,
    enabled: true,
    password: process.env.REDIS_PASSWORD,
    prefix: process.env.REDIS_PREFIX ?? 'pure-chat-test',
    tls: process.env.REDIS_TLS === 'true',
    url,
    username: process.env.REDIS_USERNAME,
  }
}

const loadRedisProvider = async () => (await import('../redis')).IoRedisRedisProvider

const createMockedProvider = async (config: Partial<RedisConfig> = {}) => {
  const instances: Array<{ options: Record<PropertyKey, unknown>; url: string }> = []

  const createPipelineMock = () => {
    const pipeMocks = {
      call: vi.fn(),
      incr: vi.fn(),
      expire: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      decr: vi.fn(),
      hget: vi.fn(),
      hset: vi.fn(),
      hdel: vi.fn(),
      hgetall: vi.fn(),
      exec: vi.fn().mockResolvedValue([]),
    }
    // 让各命令返回 pipeline 自身以支持链式调用
    for (const key of Object.keys(pipeMocks) as (keyof typeof pipeMocks)[]) {
      if (key !== 'exec') {
        pipeMocks[key].mockReturnValue(pipeMocks)
      }
    }
    return pipeMocks
  }

  const pipelineMocks = createPipelineMock()

  const mocks = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    on: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn().mockResolvedValue('OK'),
    call: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue('mock-value'),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(50),
    incr: vi.fn().mockResolvedValue(2),
    decr: vi.fn().mockResolvedValue(0),
    mget: vi.fn().mockResolvedValue(['a', 'b']),
    mset: vi.fn().mockResolvedValue('OK'),
    hget: vi.fn().mockResolvedValue('field'),
    hset: vi.fn().mockResolvedValue(1),
    hdel: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockResolvedValue({ a: '1' }),
    eval: vi.fn().mockResolvedValue(null),
    pipeline: vi.fn().mockReturnValue(pipelineMocks),
  }

  vi.resetModules()
  vi.doMock('ioredis', () => {
    class FakeRedis {
      constructor(
        public url: string,
        public options: Record<PropertyKey, unknown>
      ) {
        instances.push({ options, url })
      }
      connect = mocks.connect
      disconnect = mocks.disconnect
      on = mocks.on
      ping = mocks.ping
      quit = mocks.quit
      call = mocks.call
      get = mocks.get
      set = mocks.set
      setex = mocks.setex
      del = mocks.del
      exists = mocks.exists
      expire = mocks.expire
      ttl = mocks.ttl
      incr = mocks.incr
      decr = mocks.decr
      mget = mocks.mget
      mset = mocks.mset
      hget = mocks.hget
      hset = mocks.hset
      hdel = mocks.hdel
      hgetall = mocks.hgetall
      eval = mocks.eval
      pipeline = mocks.pipeline
    }

    return { default: FakeRedis }
  })

  const IoRedisRedisProvider = await loadRedisProvider()
  const provider = new IoRedisRedisProvider({
    enabled: true,
    prefix: 'mock',
    tls: false,
    url: 'redis://localhost:6379',
    ...config,
  })

  await provider.initialize()

  return { instances, mocks, provider }
}

const shouldSkipIntegration = (error: unknown) =>
  error instanceof Error &&
  ['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN', 'Connection is closed'].some((msg) => error.message.includes(msg))

afterEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  vi.unmock('ioredis')
})

describe('isFatalRedisAuthError', () => {
  it('detects WRONGPASS replies and ignores connection errors', async () => {
    const { isFatalRedisAuthError } = await import('../redis')

    expect(
      isFatalRedisAuthError(new Error('WRONGPASS invalid username-password pair or user is disabled.'))
    ).toBe(true)
    expect(isFatalRedisAuthError(new Error('ECONNREFUSED'))).toBe(false)
  })
})

describe('integrated', (test) => {
  const config = buildRedisConfig()
  if (!config) {
    test.skip('REDIS_URL not provided; skip integrated ioredis tests')
    return
  }

  it('set -> get -> del roundtrip', async () => {
    vi.unmock('ioredis')
    vi.resetModules()

    const IoRedisRedisProvider = await loadRedisProvider()
    const provider = new IoRedisRedisProvider(config)
    try {
      await provider.initialize()

      const key = `redis:test:${Date.now()}`
      await provider.set(key, 'value', { ex: 60 })
      expect(await provider.get(key)).toBe('value')
      expect(await provider.del(key)).toBe(1)
    } catch (error) {
      if (shouldSkipIntegration(error)) {
        // 当前环境无法连接远程 Redis，视为跳过。
        return
      }

      throw error
    } finally {
      await provider.disconnect()
    }
  })
})

describe('mocked', () => {
  it('sets bounded ioredis connection and command timeouts', async () => {
    const { instances, mocks, provider } = await createMockedProvider()

    expect(instances).toHaveLength(1)
    expect(instances[0]).toMatchObject({
      options: {
        commandTimeout: 10_000,
        connectTimeout: 10_000,
        maxRetriesPerRequest: 2,
      },
      url: 'redis://localhost:6379',
    })
    expect(typeof instances[0]?.options.retryStrategy).toBe('function')
    expect(mocks.on).toHaveBeenCalledWith('error', expect.any(Function))

    await provider.disconnect()
  })

  it('omits blank username and password when creating ioredis', async () => {
    const { instances, provider } = await createMockedProvider({
      password: '  ',
      username: '',
    })

    expect(instances[0]?.options).not.toHaveProperty('password')
    expect(instances[0]?.options).not.toHaveProperty('username')

    await provider.disconnect()
  })

  it('forwards non-empty redis credentials to ioredis', async () => {
    const { instances, provider } = await createMockedProvider({
      password: 'secret',
      username: 'purechat',
    })

    expect(instances[0]?.options).toMatchObject({
      password: 'secret',
      username: 'purechat',
    })

    await provider.disconnect()
  })

  it('stops reconnecting after WRONGPASS', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { instances, mocks, provider } = await createMockedProvider()
    const retryStrategy = instances[0]?.options.retryStrategy as (times: number) => number | null
    const onError = mocks.on.mock.calls.find(([event]) => event === 'error')?.[1] as (error: Error) => void

    expect(retryStrategy(1)).toBe(50)
    onError(new Error('WRONGPASS invalid username-password pair or user is disabled.'))
    expect(retryStrategy(2)).toBeNull()
    expect(consoleError).toHaveBeenCalledTimes(1)

    consoleError.mockRestore()
    await provider.disconnect()
  })

  it('disconnects the client when initialize authentication fails', async () => {
    const authError = new Error('WRONGPASS invalid username-password pair or user is disabled.')
    const { mocks, provider } = await createMockedProvider()

    mocks.connect.mockRejectedValueOnce(authError)
    const { IoRedisRedisProvider } = await import('../redis')
    const failing = new IoRedisRedisProvider({
      enabled: true,
      prefix: 'mock',
      tls: false,
      url: 'redis://localhost:6379',
    })

    await expect(failing.initialize()).rejects.toThrow(/WRONGPASS/)
    expect(mocks.disconnect).toHaveBeenCalled()

    await provider.disconnect()
  })

  it('normalizes set options into ioredis arguments', async () => {
    const { mocks, provider } = await createMockedProvider()
    await provider.set('key', 'value', { ex: 10, nx: true, get: true })

    expect(mocks.call).toHaveBeenCalledWith('set', 'key', 'value', 'EX', 10, 'NX', 'GET')
    await provider.disconnect()
  })

  it('forwards eval to ioredis', async () => {
    const { mocks, provider } = await createMockedProvider()
    mocks.eval.mockResolvedValue(1)

    const result = await provider.eval('return redis.call("GET", KEYS[1])', 1, 'my-key')

    expect(mocks.eval).toHaveBeenCalledWith('return redis.call("GET", KEYS[1])', 1, 'my-key')
    expect(result).toBe(1)
    await provider.disconnect()
  })

  it('pipeline chains commands and executes in one round-trip', async () => {
    const { mocks, provider } = await createMockedProvider()
    const pipeMock = mocks.pipeline()

    pipeMock.exec.mockResolvedValue([
      [null, 2],
      [null, 1],
      [null, 3],
      [null, 1],
    ])

    const pipe = provider.pipeline()
    pipe.incr('key1').expire('key1', 100).incr('key2').expire('key2', 200)
    const results = await pipe.exec()

    expect(mocks.pipeline).toHaveBeenCalled()
    expect(pipeMock.incr).toHaveBeenCalledWith('key1')
    expect(pipeMock.expire).toHaveBeenCalledWith('key1', 100)
    expect(pipeMock.incr).toHaveBeenCalledWith('key2')
    expect(pipeMock.expire).toHaveBeenCalledWith('key2', 200)
    expect(results).toHaveLength(4)
    await provider.disconnect()
  })

  it('pipeline set converts SetOptions to ioredis token args', async () => {
    const { mocks, provider } = await createMockedProvider()
    const pipeMock = mocks.pipeline()

    pipeMock.exec.mockResolvedValue([[null, 'OK']])

    const pipe = provider.pipeline()
    pipe.set('key', 'value', { ex: 60, nx: true })
    await pipe.exec()

    expect(pipeMock.call).toHaveBeenCalledWith('set', 'key', 'value', 'EX', 60, 'NX')
    await provider.disconnect()
  })

  it('supports buffer keys for hashes and strings', async () => {
    const { mocks, provider } = await createMockedProvider()

    const bufKey = Buffer.from('buffer-key')
    await provider.hset(bufKey, 'field', 'value')
    await provider.get(bufKey)

    expect(mocks.hset).toHaveBeenCalledWith(bufKey, 'field', 'value')
    expect(mocks.get).toHaveBeenCalledWith(bufKey)

    await provider.disconnect()
  })
})
