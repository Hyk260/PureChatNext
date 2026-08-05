import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { parseEnvBoolean } from './helpers'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      /** CORS 允许的来源，逗号分隔（本地需含 Vite `5174`） */
      ALLOWED_ORIGINS?: string
      /** Vercel Cron / 内部定时任务鉴权（`Authorization: Bearer …`） */
      CRON_SECRET?: string
      /** 微信 webhook 转发鉴权；可选，未设则回退 `CRON_SECRET` */
      WECHAT_WEBHOOK_SECRET?: string
      /** 本地/自托管常驻微信 Gateway。Vercel 默认关闭。 */
      WECHAT_GATEWAY_ENABLED?: string
      /** QQ 内部 gateway→webhook 转发鉴权；可选，未设则回退 `CRON_SECRET` */
      QQ_WEBHOOK_SECRET?: string
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
      CRON_SECRET: z.string().optional(),
      WECHAT_WEBHOOK_SECRET: z.string().optional(),
      WECHAT_GATEWAY_ENABLED: z.boolean(),
      QQ_WEBHOOK_SECRET: z.string().optional(),
    },
    runtimeEnv: {
      APP_URL,
      VERCEL_EDGE_CONFIG: process.env.VERCEL_EDGE_CONFIG,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
      CRON_SECRET: process.env.CRON_SECRET,
      WECHAT_WEBHOOK_SECRET: process.env.WECHAT_WEBHOOK_SECRET,
      WECHAT_GATEWAY_ENABLED: parseEnvBoolean(process.env.WECHAT_GATEWAY_ENABLED, !IS_VERCEL),
      QQ_WEBHOOK_SECRET: process.env.QQ_WEBHOOK_SECRET,
    },
  })
}

export const appEnv = getAppConfig()
