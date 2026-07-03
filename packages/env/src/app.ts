import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      ACCESS_CODE?: string
      ALLOWED_ORIGINS?: string
    }
  }
}

const isInVercel = process.env.VERCEL === '1'

const vercelUrl = `https://${process.env.VERCEL_URL}`

const APP_URL = process.env.APP_URL ? process.env.APP_URL : isInVercel ? vercelUrl : undefined

export const getAppConfig = () => {
  return createEnv({
    clientPrefix: 'NEXT_PUBLIC_',
    client: {},
    server: {
      APP_URL: z.string().optional(),
      VERCEL_EDGE_CONFIG: z.string().optional(),
      ALLOWED_ORIGINS: z.string().optional(),
    },
    runtimeEnv: {
      APP_URL,
      VERCEL_EDGE_CONFIG: process.env.VERCEL_EDGE_CONFIG,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    },
  })
}

export const appEnv = getAppConfig()
