import { createEnv } from '@t3-oss/env-core'
import type { RedisConfig } from '@pure/types'
import { z } from 'zod'

import { parseEnvBoolean, parseEnvInt } from './helpers'

export type { RedisConfig } from '@pure/types'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      REDIS_DATABASE?: string
      REDIS_PASSWORD?: string
      REDIS_PREFIX?: string
      REDIS_TLS?: string
      REDIS_URL?: string
      REDIS_USERNAME?: string
      /** 是否禁用 Redis */
      DISABLE_REDIS?: string
    }
  }
}

export const getRedisEnv = () => {
  return createEnv({
    server: {
      REDIS_DATABASE: z.number().int().optional(),
      REDIS_PASSWORD: z.string().optional(),
      REDIS_PREFIX: z.string(),
      REDIS_TLS: z.boolean().default(false),
      REDIS_URL: z.string().optional(),
      REDIS_USERNAME: z.string().optional(),
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
