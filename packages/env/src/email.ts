import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { parseEnvBoolean, parseEnvInt } from './helpers'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      /** 邮件服务提供商：`nodemailer` 或 `resend`。 */
      EMAIL_SERVICE_PROVIDER?: string
      /** Resend API Key。 */
      RESEND_API_KEY?: string
      /** Resend 发件人地址。 */
      RESEND_FROM?: string
      /** SMTP 发件人地址。 */
      SMTP_FROM?: string
      /** SMTP 服务主机名。 */
      SMTP_HOST?: string
      /** SMTP 登录密码或授权码。 */
      SMTP_PASS?: string
      /** SMTP 服务端口，例如 `465`。 */
      SMTP_PORT?: string
      /** 是否启用 SMTP TLS；465 端口通常应设为 `true`。 */
      SMTP_SECURE?: string
      /** SMTP 登录用户名，通常为邮箱地址。 */
      SMTP_USER?: string
    }
  }
}

export const getEmailConfig = () => {
  return createEnv({
    server: {
      /** 邮件服务提供商：`nodemailer` 或 `resend`。 */
      EMAIL_SERVICE_PROVIDER: z.enum(['nodemailer', 'resend']).optional(),
      /** Resend API Key。 */
      RESEND_API_KEY: z.string().optional(),
      /** Resend 发件人地址。 */
      RESEND_FROM: z.string().optional(),
      /** SMTP 发件人地址。 */
      SMTP_FROM: z.string().optional(),
      /** SMTP 服务主机名。 */
      SMTP_HOST: z.string().optional(),
      /** SMTP 服务端口。 */
      SMTP_PORT: z.coerce.number().optional(),
      /** 是否启用 SMTP TLS。 */
      SMTP_SECURE: z.boolean().optional(),
      /** SMTP 登录用户名，通常为邮箱地址。 */
      SMTP_USER: z.string().optional(),
      /** SMTP 登录密码或授权码。 */
      SMTP_PASS: z.string().optional(),
    },
    runtimeEnv: {
      SMTP_FROM: process.env.SMTP_FROM,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: parseEnvInt(process.env.SMTP_PORT),
      SMTP_SECURE: parseEnvBoolean(process.env.SMTP_SECURE),
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      EMAIL_SERVICE_PROVIDER: process.env.EMAIL_SERVICE_PROVIDER
        ? process.env.EMAIL_SERVICE_PROVIDER.toLowerCase()
        : undefined,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      RESEND_FROM: process.env.RESEND_FROM,
    },
  })
}

export const emailEnv = getEmailConfig()
