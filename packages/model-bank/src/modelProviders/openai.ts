import type { ModelProviderCard } from '../types/aiModel'
import { ModelProvider } from '../const/modelProvider'

export const openaiProviderCard: ModelProviderCard = {
  id: ModelProvider.OpenAI,
  name: 'OpenAI',
  description:
    'OpenAI 是一家领先的 AI 研究实验室，其 GPT 模型推动了自然语言处理的发展，在研究、商业和创新领域提供高性能与强价值。',
  enabled: true,
  showConfig: true,
  url: 'https://openai.com',
}
