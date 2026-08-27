import { createEnv } from '@t3-oss/env-core'
import type { RedisConfig } from '@pure/types'
import { z } from 'zod'

import { parseEnvBoolean, parseEnvInt } from './helpers'

export type { RedisConfig } from '@pure/types'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      /** Redis 数据库索引；默认使用 Redis 的 `0` 号数据库。 */
      REDIS_DATABASE?: string
      /** Redis 认证密码。 */
      REDIS_PASSWORD?: string
      /** Redis key 命名空间前缀；默认 `purechat`。 */
      REDIS_PREFIX?: string
      /** 是否强制使用 TLS；连接 `rediss://` 或托管 Redis 时启用。 */
      REDIS_TLS?: string
      /** Redis 连接字符串。 */
      REDIS_URL?: string
      /** Redis 用户名。 */
      REDIS_USERNAME?: string
      /** 是否禁用 Redis，即使已经配置 `REDIS_URL`。 */
      DISABLE_REDIS?: string
    }
  }
}

export const getRedisEnv = () => {
  return createEnv({
    server: {
      /** Redis 数据库索引。 */
      REDIS_DATABASE: z.number().int().optional(),
      /** Redis 认证密码。 */
      REDIS_PASSWORD: z.string().optional(),
      /** Redis key 命名空间前缀；默认 `purechat`。 */
      REDIS_PREFIX: z.string(),
      /** 是否强制使用 TLS；默认关闭。 */
      REDIS_TLS: z.boolean().default(false),
      /** Redis 连接字符串。 */
      REDIS_URL: z.string().optional(),
      /** Redis 用户名。 */
      REDIS_USERNAME: z.string().optional(),
      /** 是否禁用 Redis，即使已经配置 `REDIS_URL`；默认关闭。 */
      DISABLE_REDIS: z.boolean().default(false),
    },
    runtimeEnv: {
      REDIS_DATABASE: parseEnvInt(process.env.REDIS_DATABASE),
      REDIS_PASSWORD: process.env.REDIS_PASSWORD,
      REDIS_PREFIX: process.env.REDIS_PREFIX || 'purechat',
      REDIS_TLS: parseEnvBoolean(process.env.REDIS_TLS),
      REDIS_URL: process.env.REDIS_URL,
      REDIS_USERNAME: process.env.REDIS_USERNAME,
      DISABLE_REDIS: parseEnvBoolean(process.env.DISABLE_REDIS),
    },
  })
}

export const redisEnv = getRedisEnv()

export const getRedisConfig = (): RedisConfig => {
  if (!redisEnv.REDIS_URL) {
    return {
      enabled: false,
      prefix: redisEnv.REDIS_PREFIX,
      tls: false,
      url: '',
    }
  }

  return {
    database: redisEnv.REDIS_DATABASE,
    enabled: true,
    password: redisEnv.REDIS_PASSWORD,
    prefix: redisEnv.REDIS_PREFIX,
    tls: redisEnv.REDIS_TLS,
    url: redisEnv.REDIS_URL,
    username: redisEnv.REDIS_USERNAME,
  }
}
