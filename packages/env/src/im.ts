import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      IM_SDK_APPID?: string
      IM_SDK_KEY?: string
      IM_ADMIN_ISTRATOR?: string
      IM_SERVER_BASE_URL?: string
      IM_REQUEST_TIMEOUT?: string
    }
  }
}

export const getIMConfig = () => {
  return createEnv({
    server: {
      IM_SDK_APPID: z.string().optional(),
      IM_SDK_KEY: z.string().optional(),
      IM_ADMIN_ISTRATOR: z.string().optional(),
      IM_SERVER_BASE_URL: z.string().optional(),
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
