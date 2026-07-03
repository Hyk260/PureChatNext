import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const getFileConfig = () => {
  return createEnv({
    clientPrefix: 'NEXT_PUBLIC_',
    client: {},
    server: {
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
      // S3
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
      S3_BUCKET: process.env.S3_BUCKET,
      S3_ENABLE_PATH_STYLE: process.env.S3_ENABLE_PATH_STYLE === '1',
      S3_ENDPOINT: process.env.S3_ENDPOINT,
      S3_PREVIEW_URL_EXPIRE_IN: parseInt(process.env.S3_PREVIEW_URL_EXPIRE_IN || '7200'),
      S3_REGION: process.env.S3_REGION,
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
      S3_SET_ACL: process.env.S3_SET_ACL === '1',
    },
  })
}

export const fileEnv = getFileConfig()
