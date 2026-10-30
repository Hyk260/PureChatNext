import type { ModelProviderCard } from '../types/aiModel'
import { ModelProvider } from '../const/modelProvider'

export const openRouterProviderCard: ModelProviderCard = {
  id: ModelProvider.OpenRouter,
  name: 'OpenRouter',
  description: '通过 OpenRouter 使用来自多家模型提供商的 AI 模型。',
  enabled: false,
  showConfig: true,
  url: 'https://openrouter.ai',
}
