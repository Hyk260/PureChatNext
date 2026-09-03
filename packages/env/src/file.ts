import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { parseEnvBoolean, parseEnvInt } from './helpers'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      /** 单个用户的文件存储总额度，单位为 MB；默认 `15`。 */
      FILE_STORAGE_LIMIT_MB?: string
      /** S3 访问密钥 ID。 */
      S3_ACCESS_KEY_ID?: string
      /** S3 存储桶名称。 */
      S3_BUCKET?: string
      /** 是否启用 S3 path-style 访问，MinIO / RustFS 等服务通常需要开启。 */
      S3_ENABLE_PATH_STYLE?: string
      /** S3 兼容服务的请求端点。 */
      S3_ENDPOINT?: string
      /** 预览 URL 的有效期，单位为秒；默认 `7200`。 */
      S3_PREVIEW_URL_EXPIRE_IN?: string
      /** S3 区域，例如 `us-west-1`。 */
      S3_REGION?: string
      /** S3 访问密钥。 */
      S3_SECRET_ACCESS_KEY?: string
      /** 是否在上传对象时设置 `public-read` ACL。 */
      S3_SET_ACL?: string
    }
  }
}

export const getFileConfig = () => {
  return createEnv({
    clientPrefix: 'NEXT_PUBLIC_',
    client: {},
    server: {
      /** 单个用户的文件存储总额度，单位为 MB；默认 `15`。 */
      FILE_STORAGE_LIMIT_MB: z.number().int().positive(),
      /** S3 访问密钥 ID。 */
      S3_ACCESS_KEY_ID: z.string().optional(),
      /** S3 存储桶名称。 */
      S3_BUCKET: z.string().optional(),
      /** 是否启用 S3 path-style 访问，MinIO / RustFS 等服务通常需要开启。 */
      S3_ENABLE_PATH_STYLE: z.boolean(),
      /** S3 兼容服务的请求端点。 */
      S3_ENDPOINT: z.string().url().optional(),
      /** 预览 URL 的有效期，单位为秒；默认 `7200`。 */
      S3_PREVIEW_URL_EXPIRE_IN: z.number(),
      /** S3 区域，例如 `us-west-1`。 */
      S3_REGION: z.string().optional(),
      /** S3 访问密钥。 */
      S3_SECRET_ACCESS_KEY: z.string().optional(),
      /** 是否在上传对象时设置 `public-read` ACL。 */
      S3_SET_ACL: z.boolean(),
    },
    runtimeEnv: {
      FILE_STORAGE_LIMIT_MB: parseEnvInt(process.env.FILE_STORAGE_LIMIT_MB, 15),
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
