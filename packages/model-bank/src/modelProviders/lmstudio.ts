import type { ModelProviderCard } from '../types/aiModel'
import { ModelProvider } from '../const/modelProvider'

export const lmStudioProviderCard: ModelProviderCard = {
  id: ModelProvider.LmStudio,
  name: 'LM Studio',
  description: '连接桌面上的 LM Studio 本地模型服务。',
  enabled: false,
  showConfig: true,
  url: 'https://lmstudio.ai',
}
