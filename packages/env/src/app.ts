import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { parseEnvBoolean } from './helpers'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      /** CORS 允许的来源，逗号分隔（本地需含 Vite `5174`） */
      ALLOWED_ORIGINS?: string
      /** 本地 cloudflared TryCloudflare 隧道；同时放开 Vite Host 与 Auth/CORS Origin */
      ALLOW_TRYCLOUDFLARE?: string
      /** Vercel Cron / 内部定时任务鉴权（`Authorization: Bearer …`） */
      CRON_SECRET?: string
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
      APP_URL: z.string().optional(),
      VERCEL_EDGE_CONFIG: z.string().optional(),
      ALLOWED_ORIGINS: z.string().optional(),
      ALLOW_TRYCLOUDFLARE: z.boolean(),
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
