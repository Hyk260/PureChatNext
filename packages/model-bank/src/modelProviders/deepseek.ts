import type { ModelProviderCard } from '../types/aiModel'
import { ModelProvider } from '../const/modelProvider'

export const deepseekProviderCard: ModelProviderCard = {
  id: ModelProvider.DeepSeek,
  name: 'DeepSeek',
  description:
    'DeepSeek 专注于人工智能研究与应用。其最新的 DeepSeek V4 系列包含 Flash 和 Pro 两个版本，具备 100 万上下文窗口和混合式思维能力，在推理与智能体基准测试中可与领先的闭源前沿模型竞争。',
  enabled: true,
  showConfig: true,
  url: 'https://deepseek.com',
}
