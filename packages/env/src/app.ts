import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { parseEnvBoolean } from './helpers'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      ACCESS_CODE?: string
      ALLOWED_ORIGINS?: string
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
    },
    runtimeEnv: {
      APP_URL,
      VERCEL_EDGE_CONFIG: process.env.VERCEL_EDGE_CONFIG,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    },
  })
}

export const appEnv = getAppConfig()
