import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      /**
       * 数据库连接模式。
       * 云托管（Supabase / Neon）用 `neon` 强制 SSL；本地或 Docker PostgreSQL 用 `node`。
       * @default neon
       */
      DATABASE_DRIVER?: string
      /** 测试库连接字符串；未设置时回退到 `DATABASE_URL`。 */
      DATABASE_TEST_URL?: string
      /** PostgreSQL 连接字符串，用于 Drizzle 迁移与运行时连接。 */
      DATABASE_URL?: string
      /** 敏感配置加密密钥，用于渠道凭证、`context_token` 与 API key 哈希。 */
      KEY_VAULTS_SECRET?: string
      /** 遗留 Supabase 客户端项目 URL；仅调试时需要。 */
      NEXT_PUBLIC_SUPABASE_URL?: string
      /** 遗留 Supabase 匿名/公开密钥；仅调试时需要。 */
      NEXT_PUBLIC_SUPABASE_ANON_KEY?: string
    }
  }
}

export type ServerDBEnv = {
  /**
   * 数据库连接模式。
   * 云托管（Supabase / Neon）用 `neon` 强制 SSL；本地或 Docker PostgreSQL 用 `node`。
   * @default neon
   */
  DATABASE_DRIVER: 'neon' | 'node'
  /** 测试库连接字符串；未设时回退 `DATABASE_URL` */
  DATABASE_TEST_URL?: string
  /** PostgreSQL 连接字符串，用于 Drizzle 迁移与运行时连接 */
  DATABASE_URL?: string
  /** 敏感配置加密密钥，用于渠道凭证、`context_token` 与 API key 哈希 */
  KEY_VAULTS_SECRET?: string
  /** 遗留 Supabase 客户端项目 URL；仅调试时需要 */
  NEXT_PUBLIC_SUPABASE_URL?: string
  /** 遗留 Supabase 匿名/公开密钥；仅调试时需要 */
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string
}

export const getServerDBConfig = (): ServerDBEnv => {
  return createEnv({
    clientPrefix: 'NEXT_PUBLIC_',
    client: {
      NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
    },
    server: {
      DATABASE_DRIVER: z.enum(['neon', 'node']),
      DATABASE_TEST_URL: z.string().optional(),
      DATABASE_URL: z.string().optional(),
      KEY_VAULTS_SECRET: z.string().optional(),
    },
    runtimeEnv: {
      DATABASE_DRIVER: process.env.DATABASE_DRIVER || 'neon',
      DATABASE_TEST_URL: process.env.DATABASE_TEST_URL,
      DATABASE_URL: process.env.DATABASE_URL,

      KEY_VAULTS_SECRET: process.env.KEY_VAULTS_SECRET,

      // supabase config
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
  })
}

export const serverDBEnv: ServerDBEnv = getServerDBConfig()
