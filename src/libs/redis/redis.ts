import debug from 'debug'
import type { Redis } from 'ioredis'

import type {
  BaseRedisProvider,
  RedisConfig,
  RedisKey,
  RedisMSetArgument,
  RedisPipeline,
  RedisSetResult,
  RedisValue,
  SetOptions,
} from './types'
import { buildIORedisSetArgs, normalizeMsetValues } from './utils'

const log = debug('redis:debug')

const REDIS_CONNECT_TIMEOUT_MS = 10_000
const REDIS_COMMAND_TIMEOUT_MS = 10_000
const REDIS_RETRY_MAX_DELAY_MS = 2000
const FATAL_REDIS_AUTH_RE = /WRONGPASS|invalid username-password|user is disabled/i

export const isFatalRedisAuthError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return FATAL_REDIS_AUTH_RE.test(message)
}

const nonEmpty = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const ioredisAuthOptions = (config: RedisConfig) => {
  const password = nonEmpty(config.password)
  const username = nonEmpty(config.username)
  return {
    ...(password ? { password } : {}),
    ...(username ? { username } : {}),
  }
}

export class IoRedisRedisProvider implements BaseRedisProvider {
  private client: Redis | null = null
  private loggedFatalAuth = false

  constructor(private config: RedisConfig) {}

  async initialize() {
    const IORedis = await import('ioredis')
    let stopReconnect = false

    this.client = new IORedis.default(this.config.url, {
      commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      db: this.config.database,
      keyPrefix: this.config.prefix ? `${this.config.prefix}:` : undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => {
        if (stopReconnect) return null
        return Math.min(times * 50, REDIS_RETRY_MAX_DELAY_MS)
      },
      tls: this.config.tls ? {} : undefined,
      ...ioredisAuthOptions(this.config),
    })

    this.client.on('error', (error) => {
      if (!isFatalRedisAuthError(error)) {
        log('Redis client error: %O', error)
        return
      }

      stopReconnect = true
      if (this.loggedFatalAuth) return
      this.loggedFatalAuth = true
      console.error('[redis] authentication failed; stopped reconnecting. Check REDIS_USERNAME / REDIS_PASSWORD.')
      log('Redis authentication failed: %O', error)
    })

    try {
      await this.client.connect()
      await this.client.ping()
    } catch (error) {
      if (isFatalRedisAuthError(error)) stopReconnect = true
      this.stopClient()
      throw error
    }

    log('Connected to Redis provider with prefix "%s"', this.config.prefix)
  }

  async disconnect() {
    const client = this.client
    this.client = null
    if (!client) return

    try {
      await client.quit()
    } catch (error) {
      log('Redis quit failed, forcing disconnect: %O', error)
      client.disconnect()
    }
  }

  private stopClient() {
    const client = this.client
    this.client = null
    client?.disconnect()
  }

  private ensureClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client is not initialized')
    }

    return this.client
  }

  async get(key: RedisKey): Promise<string | null> {
    return this.ensureClient().get(key)
  }

  async set(key: RedisKey, value: RedisValue, options?: SetOptions): Promise<RedisSetResult> {
    const args = buildIORedisSetArgs(options)

    return this.ensureClient().call('set', key, value, ...args) as Promise<RedisSetResult>
  }

  async setex(key: RedisKey, seconds: number, value: RedisValue): Promise<'OK'> {
    return this.ensureClient().setex(key, seconds, value)
  }

  async del(...keys: RedisKey[]): Promise<number> {
    return this.ensureClient().del(...keys)
  }

  async exists(...keys: RedisKey[]): Promise<number> {
    return this.ensureClient().exists(...keys)
  }

  async expire(key: RedisKey, seconds: number): Promise<number> {
    return this.ensureClient().expire(key, seconds)
  }

  async ttl(key: RedisKey): Promise<number> {
    return this.ensureClient().ttl(key)
  }

  async incr(key: RedisKey): Promise<number> {
    return this.ensureClient().incr(key)
  }

  async decr(key: RedisKey): Promise<number> {
    return this.ensureClient().decr(key)
  }

  async mget(...keys: RedisKey[]): Promise<(string | null)[]> {
    return this.ensureClient().mget(...keys)
  }

  async mset(values: RedisMSetArgument): Promise<'OK'> {
    return this.ensureClient().mset(normalizeMsetValues(values))
  }

  async ping(): Promise<string> {
    return this.ensureClient().ping()
  }

  async hget(key: RedisKey, field: RedisKey): Promise<string | null> {
    return this.ensureClient().hget(key, field)
  }

  async hset(key: RedisKey, field: RedisKey, value: RedisValue): Promise<number> {
    return this.ensureClient().hset(key, field, value)
  }

  async hdel(key: RedisKey, ...fields: RedisKey[]): Promise<number> {
    return this.ensureClient().hdel(key, ...fields)
  }

  async hgetall(key: RedisKey): Promise<Record<string, string>> {
    return this.ensureClient().hgetall(key)
  }

  async eval<T = unknown>(script: string, numkeys: number, ...args: RedisValue[]): Promise<T> {
    return this.ensureClient().eval(script, numkeys, ...args) as Promise<T>
  }

  pipeline(): RedisPipeline {
    const raw = this.ensureClient().pipeline()
    const pipe: RedisPipeline = {
      decr: (key) => (raw.decr(key), pipe),
      del: (...keys) => (raw.del(...keys), pipe),
      exec: () => raw.exec() as Promise<[Error | null, unknown][] | null>,
      expire: (key, seconds) => (raw.expire(key, seconds), pipe),
      get: (key) => (raw.get(key), pipe),
      hdel: (key, ...fields) => (raw.hdel(key, ...fields), pipe),
      hget: (key, field) => (raw.hget(key, field), pipe),
      hgetall: (key) => (raw.hgetall(key), pipe),
      hset: (key, field, value) => (raw.hset(key, field, value), pipe),
      incr: (key) => (raw.incr(key), pipe),
      set: (key, value, options?) => {
        const args = buildIORedisSetArgs(options)
        raw.call('set', key, value, ...args)
        return pipe
      },
      setex: (key, seconds, value) => (raw.setex(key, seconds, value), pipe),
    }
    return pipe
  }
}
