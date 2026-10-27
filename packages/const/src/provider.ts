export enum ModelProvider {
  PureChat = 'purechat',
  OpenAI = 'openai',
  DeepSeek = 'deepseek',
}

export type ModelProviderId = `${ModelProvider}`

export const MISSING_USER_PROVIDER_SECRET_MESSAGE = '请先在设置中保存该服务商 API Key'

export const BUILTIN_PROVIDER_ID_LIST = ['purechat', 'openai', 'deepseek'] as const
export const BUILTIN_PROVIDER_IDS: ReadonlySet<string> = new Set(BUILTIN_PROVIDER_ID_LIST)

export const isBuiltinProviderId = (id: string): id is ModelProviderId => BUILTIN_PROVIDER_IDS.has(id)

export const isValidProviderId = (id: string): boolean =>
  /^[a-z0-9][a-z0-9_-]{0,31}$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id)
