import { llmEnv } from '@/envs/llm'

export type ProviderEnvKeyId = 'openai' | 'deepseek' | 'bailian'

/** Boolean flags only — never return the secret itself. */
export const getProviderEnvKeyFlags = (): Record<ProviderEnvKeyId, boolean> => ({
  bailian: Boolean(llmEnv.DASHSCOPE_API_KEY?.trim()),
  deepseek: Boolean(llmEnv.DEEPSEEK_API_KEY?.trim()),
  openai: Boolean(llmEnv.OPENAI_API_KEY?.trim()),
})
