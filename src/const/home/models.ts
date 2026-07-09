import { COMMUNITY_PROVIDERS } from '@/const/community/providers'

export interface HomeModelItem {
  displayName: string
  model: string
  provider: string
}

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'deepseek-chat': 'DeepSeek V4 Pro',
  'deepseek-reasoner': 'DeepSeek Reasoner',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  o1: 'OpenAI o1',
  'o3-mini': 'OpenAI o3-mini',
}

export const HOME_MODELS: HomeModelItem[] = COMMUNITY_PROVIDERS.flatMap((provider) =>
  provider.models.map((model) => ({
    displayName: MODEL_DISPLAY_NAMES[model] ?? model,
    model,
    provider: provider.identifier,
  })),
)

export const DEFAULT_HOME_MODEL: HomeModelItem = {
  displayName: 'DeepSeek V4 Pro',
  model: 'deepseek-chat',
  provider: 'deepseek',
}

export const findHomeModel = (provider: string, model: string) =>
  HOME_MODELS.find((item) => item.provider === provider && item.model === model) ?? DEFAULT_HOME_MODEL

export const groupHomeModelsByProvider = () => {
  const groups = new Map<string, HomeModelItem[]>()

  for (const item of HOME_MODELS) {
    const list = groups.get(item.provider) ?? []
    list.push(item)
    groups.set(item.provider, list)
  }

  return groups
}
