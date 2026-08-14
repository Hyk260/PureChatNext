import type { ModelProviderCard } from '../types/aiModel'
import { ModelProvider } from '../const/modelProvider'

export const purechatProviderCard: ModelProviderCard = {
  id: ModelProvider.PureChat,
  name: 'PureChat',
  description: 'PureChat 通过官方 API 接入 AI 模型，并按模型令牌用量消耗积分。',
  enabled: true,
  showConfig: false,
  settings: {
    modelEditable: false,
    showAddNewModel: false,
    showModelFetcher: false,
  },
  url: 'https://purechat.cn',
}
