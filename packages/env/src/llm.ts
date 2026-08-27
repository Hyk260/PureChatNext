import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { parseEnvBooleanDefaultTrue } from './helpers'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      /** API Key 选择策略，例如 `random` 或 `turn`。 */
      API_KEY_SELECT_MODE?: string
      /** 是否启用 OpenAI Provider；默认开启。 */
      ENABLED_OPENAI?: string
      /** OpenAI API Key。 */
      OPENAI_API_KEY?: string
      /** DeepSeek API Key。 */
      DEEPSEEK_API_KEY?: string
      /** 是否启用 PureChat / Vercel AI Gateway；默认开启。 */
      PURECHAT_ENABLED?: string
      /** PureChat / Vercel AI Gateway API Key。 */
      PURECHAT_API_KEY?: string
      /** Vercel AI Gateway API Key，服务端使用，不暴露给浏览器。 */
      AI_GATEWAY_API_KEY?: string
      /** AI Gateway 请求地址；默认 `https://ai-gateway.vercel.sh/v1`。 */
      AI_GATEWAY_BASE_URL?: string
      /** Vercel OIDC Token，用于访问 Vercel AI Gateway。 */
      VERCEL_OIDC_TOKEN?: string
    }
  }
}

export const getLLMConfig = () => {
  return createEnv({
    server: {
      /** API Key 选择策略，例如 `random` 或 `turn`。 */
      API_KEY_SELECT_MODE: z.string().optional(),
      /** 是否启用 OpenAI Provider；默认开启。 */
      ENABLED_OPENAI: z.boolean(),
      /** OpenAI API Key。 */
      OPENAI_API_KEY: z.string().optional(),
      /** 是否启用 DeepSeek Provider；由 `DEEPSEEK_API_KEY` 是否存在决定。 */
      ENABLED_DEEPSEEK: z.boolean(),
      /** DeepSeek API Key。 */
      DEEPSEEK_API_KEY: z.string().optional(),
      /** 是否启用 PureChat / Vercel AI Gateway；默认开启。 */
      PURECHAT_ENABLED: z.boolean(),
      /** PureChat / Vercel AI Gateway API Key。 */
      PURECHAT_API_KEY: z.string().optional(),
      /** Vercel AI Gateway API Key，服务端使用，不暴露给浏览器。 */
      AI_GATEWAY_API_KEY: z.string().optional(),
      /** AI Gateway 请求地址；默认 `https://ai-gateway.vercel.sh/v1`。 */
      AI_GATEWAY_BASE_URL: z.string().optional(),
      /** Vercel OIDC Token，用于访问 Vercel AI Gateway。 */
      VERCEL_OIDC_TOKEN: z.string().optional(),
    },
    runtimeEnv: {
      // API Key 选择模式
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
      VERCEL_OIDC_TOKEN: process.env.VERCEL_OIDC_TOKEN,
    },
  })
}

export const llmEnv = getLLMConfig()

export const resolveAiGatewayApiKey = () => {
  return llmEnv.AI_GATEWAY_API_KEY?.trim() || llmEnv.PURECHAT_API_KEY?.trim() || undefined
}

export const resolveAiGatewayBaseURL = () => llmEnv.AI_GATEWAY_BASE_URL?.trim() || 'https://ai-gateway.vercel.sh/v1'
