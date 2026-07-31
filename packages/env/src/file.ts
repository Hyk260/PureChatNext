import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { parseEnvBoolean, parseEnvInt } from './helpers'

export const getFileConfig = () => {
  return createEnv({
    clientPrefix: 'NEXT_PUBLIC_',
    client: {},
    server: {
      FILE_STORAGE_LIMIT_MB: z.number().int().positive(),
      S3_ACCESS_KEY_ID: z.string().optional(),
      S3_BUCKET: z.string().optional(),
      S3_ENABLE_PATH_STYLE: z.boolean(),
      S3_ENDPOINT: z.string().url().optional(),
      S3_PREVIEW_URL_EXPIRE_IN: z.number(),
      S3_REGION: z.string().optional(),
      S3_SECRET_ACCESS_KEY: z.string().optional(),
      S3_SET_ACL: z.boolean(),
    },
    runtimeEnv: {
      FILE_STORAGE_LIMIT_MB:
        process.env.FILE_STORAGE_LIMIT_MB === undefined || process.env.FILE_STORAGE_LIMIT_MB === ''
          ? 15
          : Number(process.env.FILE_STORAGE_LIMIT_MB),
      // S3
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
      S3_BUCKET: process.env.S3_BUCKET,
      S3_ENABLE_PATH_STYLE: parseEnvBoolean(process.env.S3_ENABLE_PATH_STYLE),
      S3_ENDPOINT: process.env.S3_ENDPOINT,
      S3_PREVIEW_URL_EXPIRE_IN: parseEnvInt(process.env.S3_PREVIEW_URL_EXPIRE_IN, 7200) ?? 7200,
      S3_REGION: process.env.S3_REGION,
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
      S3_SET_ACL: parseEnvBoolean(process.env.S3_SET_ACL),
    },
  })
}

export const fileEnv = getFileConfig()

export const fileStorageLimitBytes = fileEnv.FILE_STORAGE_LIMIT_MB * 1024 * 1024
