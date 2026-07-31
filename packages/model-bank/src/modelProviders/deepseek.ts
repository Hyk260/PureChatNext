import type { ModelProviderCard } from '../types/aiModel'
import { ModelProvider } from '../const/modelProvider'

export const deepseekProviderCard: ModelProviderCard = {
  id: ModelProvider.DeepSeek,
  name: 'DeepSeek',
  description:
    'DeepSeek 专注于 AI 研究与应用。其最新 DeepSeek V4 系列提供 Flash 与 Pro 变体，具备 1M 上下文窗口与混合推理能力。',
  enabled: true,
  showConfig: true,
  url: 'https://deepseek.com',
}
