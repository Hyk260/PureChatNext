import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { parseEnvBoolean } from './helpers'

const IS_VERCEL = parseEnvBoolean(process.env.VERCEL)

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      /** 内置渠道 Gateway 总开关；本地默认关闭，Docker 需显式开启。 */
      CHANNEL_GATEWAY_ENABLED?: string
      /** Gateway 回调 Next Server 的内部地址；默认使用本机回环地址。 */
      CHANNEL_GATEWAY_INTERNAL_URL?: string
      /** Gateway 回调内部 Webhook 的统一鉴权密钥。 */
      CHANNEL_GATEWAY_INTERNAL_SECRET?: string
      /** 微信 webhook 转发鉴权；可选，未设则回退 `CRON_SECRET` */
      WECHAT_WEBHOOK_SECRET?: string
      /** 本地/自托管常驻微信 Gateway。Vercel 默认关闭。 */
      WECHAT_GATEWAY_ENABLED?: string
      /** 调试时输出截断后的微信消息正文；生产默认关闭。 */
      WECHAT_GATEWAY_LOG_MESSAGE_TEXT?: string
      /** QQ 内部 gateway→webhook 转发鉴权；可选，未设则回退 `CRON_SECRET` */
      QQ_WEBHOOK_SECRET?: string
    }
  }
}

export const getGatewayConfig = () => {
  return createEnv({
    server: {
      CHANNEL_GATEWAY_ENABLED: z.boolean(),
      CHANNEL_GATEWAY_INTERNAL_URL: z.string().url().optional(),
      CHANNEL_GATEWAY_INTERNAL_SECRET: z.string().optional(),
      WECHAT_WEBHOOK_SECRET: z.string().optional(),
      WECHAT_GATEWAY_ENABLED: z.boolean(),
      WECHAT_GATEWAY_LOG_MESSAGE_TEXT: z.boolean(),
      QQ_WEBHOOK_SECRET: z.string().optional(),
    },
    runtimeEnv: {
      CHANNEL_GATEWAY_ENABLED: IS_VERCEL
        ? false
        : parseEnvBoolean(process.env.CHANNEL_GATEWAY_ENABLED, parseEnvBoolean(process.env.WECHAT_GATEWAY_ENABLED)),
      CHANNEL_GATEWAY_INTERNAL_URL: process.env.CHANNEL_GATEWAY_INTERNAL_URL,
      CHANNEL_GATEWAY_INTERNAL_SECRET: process.env.CHANNEL_GATEWAY_INTERNAL_SECRET,
      WECHAT_WEBHOOK_SECRET: process.env.WECHAT_WEBHOOK_SECRET,
      WECHAT_GATEWAY_ENABLED: IS_VERCEL ? false : parseEnvBoolean(process.env.WECHAT_GATEWAY_ENABLED),
      WECHAT_GATEWAY_LOG_MESSAGE_TEXT: parseEnvBoolean(process.env.WECHAT_GATEWAY_LOG_MESSAGE_TEXT),
      QQ_WEBHOOK_SECRET: process.env.QQ_WEBHOOK_SECRET,
    },
  })
}

export const gatewayEnv = getGatewayConfig()
