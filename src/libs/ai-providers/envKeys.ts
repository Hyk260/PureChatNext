export type ProviderEnvKeyId = 'openai' | 'deepseek'

/** Boolean flags only — never return the secret itself. */
export const getProviderEnvKeyFlags = (): Record<ProviderEnvKeyId, boolean> => ({
  deepseek: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
  openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
})
