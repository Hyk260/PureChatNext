import type { ModelProviderCard } from '../types/aiModel'
import { ModelProvider } from '@pure/const'

export const bailianProviderCard: ModelProviderCard = {
  id: ModelProvider.Bailian,
  name: '阿里云百炼',
  description: '阿里云百炼提供通义千问等大模型服务，可通过 OpenAI 兼容接口接入。',
  enabled: true,
  showConfig: true,
  url: 'https://bailian.console.aliyun.com/',
}
