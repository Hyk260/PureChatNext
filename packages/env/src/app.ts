import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { parseEnvBoolean } from './helpers'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      /** 对外访问地址，用于 Better Auth、邮件和 OAuth 回调；本地应使用 Vite SPA 的 `5174` 端口。 */
      APP_URL?: string
      /** CORS 允许的来源，逗号分隔（本地需含 Vite `5174`） */
      ALLOWED_ORIGINS?: string
      /** 本地 cloudflared TryCloudflare 隧道；同时放开 Vite Host 与 Auth/CORS Origin */
      ALLOW_TRYCLOUDFLARE?: string
      /** Vercel Cron / 内部定时任务鉴权（`Authorization: Bearer …`） */
      CRON_SECRET?: string
      /** Vercel Edge Config 连接字符串。 */
      VERCEL_EDGE_CONFIG?: string
      /** Vercel 平台注入的部署标识；设为 `1` 时表示运行在 Vercel。 */
      VERCEL?: string
      /** Vercel 平台注入的当前部署域名，用于拼接默认 `APP_URL`。 */
      VERCEL_URL?: string
    }
  }
}

/** True when running on Vercel (`VERCEL=1`). */
export const IS_VERCEL = parseEnvBoolean(process.env.VERCEL)

const vercelUrl = `https://${process.env.VERCEL_URL}`

const APP_URL = process.env.APP_URL ? process.env.APP_URL : IS_VERCEL ? vercelUrl : undefined

export const getAppConfig = () => {
  return createEnv({
    clientPrefix: 'NEXT_PUBLIC_',
    client: {},
    server: {
      /** 对外访问地址，用于 Better Auth、邮件和 OAuth 回调；本地应使用 Vite SPA 的 `5174` 端口。 */
      APP_URL: z.string().optional(),
      /** Vercel Edge Config 连接字符串。 */
      VERCEL_EDGE_CONFIG: z.string().optional(),
      /** CORS 允许的来源，逗号分隔（本地需含 Vite `5174`）。 */
      ALLOWED_ORIGINS: z.string().optional(),
      /** 本地是否启用 cloudflared TryCloudflare 隧道；默认关闭。 */
      ALLOW_TRYCLOUDFLARE: z.boolean(),
      /** Vercel Cron / 内部定时任务鉴权密钥。 */
      CRON_SECRET: z.string().optional(),
    },
    runtimeEnv: {
      APP_URL,
      VERCEL_EDGE_CONFIG: process.env.VERCEL_EDGE_CONFIG,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
      ALLOW_TRYCLOUDFLARE: parseEnvBoolean(process.env.ALLOW_TRYCLOUDFLARE),
      CRON_SECRET: process.env.CRON_SECRET,
    },
  })
}

export const appEnv = getAppConfig()
