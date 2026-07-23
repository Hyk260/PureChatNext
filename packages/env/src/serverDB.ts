import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const getServerDBConfig = () => {
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

export const serverDBEnv = getServerDBConfig()
