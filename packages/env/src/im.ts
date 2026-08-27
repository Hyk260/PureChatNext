import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      /** 腾讯云 IM 管理员账号 ID。 */
      IM_SDK_APPID?: string
      /** 腾讯云 IM SDK 密钥；属于敏感信息。 */
      IM_SDK_KEY?: string
      /** 腾讯云 IM 管理员账号；可选。 */
      IM_ADMIN_ISTRATOR?: string
      /** 腾讯云 IM 服务请求地址。 */
      IM_SERVER_BASE_URL?: string
      /** 腾讯云 IM 请求超时时间。 */
      IM_REQUEST_TIMEOUT?: string
    }
  }
}

export const getIMConfig = () => {
  return createEnv({
    server: {
      /** 腾讯云 IM 管理员账号 ID。 */
      IM_SDK_APPID: z.string().optional(),
      /** 腾讯云 IM SDK 密钥；属于敏感信息。 */
      IM_SDK_KEY: z.string().optional(),
      /** 腾讯云 IM 管理员账号；可选。 */
      IM_ADMIN_ISTRATOR: z.string().optional(),
      /** 腾讯云 IM 服务请求地址。 */
      IM_SERVER_BASE_URL: z.string().optional(),
      /** 腾讯云 IM 请求超时时间。 */
      IM_REQUEST_TIMEOUT: z.string().optional(),
    },
    runtimeEnv: {
      IM_SDK_APPID: process.env.IM_SDK_APPID,
      IM_SDK_KEY: process.env.IM_SDK_KEY,
      IM_ADMIN_ISTRATOR: process.env.IM_ADMIN_ISTRATOR,
      IM_SERVER_BASE_URL: process.env.IM_SERVER_BASE_URL,
      IM_REQUEST_TIMEOUT: process.env.IM_REQUEST_TIMEOUT,
    },
  })
}

export const imEnv = getIMConfig()
