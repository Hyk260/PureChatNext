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

      /** PureChat */
      PURECHAT_ENABLED: z.boolean(),
      PURECHAT_API_KEY: z.string().optional(),
      /** AI Gateway */
      AI_GATEWAY_API_KEY: z.string().optional(),
      AI_GATEWAY_BASE_URL: z.string().optional(),
    },
    runtimeEnv: {
      API_KEY_SELECT_MODE: process.env.API_KEY_SELECT_MODE,
      // OpenAI
      ENABLED_OPENAI: parseEnvBooleanDefaultTrue(process.env.ENABLED_OPENAI),
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      // Deepseek
      ENABLED_DEEPSEEK: !!process.env.DEEPSEEK_API_KEY,
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
      // PureChat
      PURECHAT_ENABLED: parseEnvBooleanDefaultTrue(process.env.PURECHAT_ENABLED),
      PURECHAT_API_KEY: process.env.PURECHAT_API_KEY,
      // AI Gateway
      AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
      AI_GATEWAY_BASE_URL: process.env.AI_GATEWAY_BASE_URL,
    },
  })
}

export const llmEnv = getLLMConfig()

export const resolveAiGatewayApiKey = () =>
  llmEnv.AI_GATEWAY_API_KEY?.trim() || llmEnv.PURECHAT_API_KEY?.trim() || undefined

export const resolveAiGatewayBaseURL = () => llmEnv.AI_GATEWAY_BASE_URL?.trim() || 'https://ai-gateway.vercel.sh/v1'
