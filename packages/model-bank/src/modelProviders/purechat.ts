import type { ModelProviderCard } from '../types/aiModel'
import { ModelProvider } from '../const/modelProvider'

export const purechatProviderCard: ModelProviderCard = {
  id: ModelProvider.PureChat,
  name: 'PureChat',
  description: 'PureChat 官方接入模型，用量以 Credits 计量；无需配置 API Key。',
  enabled: true,
  showConfig: false,
  settings: {
    modelEditable: false,
    showAddNewModel: false,
    showModelFetcher: false,
  },
  url: 'https://purechat.cn',
}
