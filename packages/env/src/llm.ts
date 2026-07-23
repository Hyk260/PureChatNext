import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { parseEnvBooleanDefaultTrue } from './helpers'

export const getLLMConfig = () => {
  return createEnv({
    server: {
      API_KEY_SELECT_MODE: z.string().optional(),

      ENABLED_OPENAI: z.boolean(),
      OPENAI_API_KEY: z.string().optional(),

      ENABLED_DEEPSEEK: z.boolean(),
      DEEPSEEK_API_KEY: z.string().optional(),
    },
    runtimeEnv: {
      API_KEY_SELECT_MODE: process.env.API_KEY_SELECT_MODE,
      // OpenAI
      ENABLED_OPENAI: parseEnvBooleanDefaultTrue(process.env.ENABLED_OPENAI),
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      // Deepseek
      ENABLED_DEEPSEEK: !!process.env.DEEPSEEK_API_KEY,
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    },
  })
}

export const llmEnv = getLLMConfig()
