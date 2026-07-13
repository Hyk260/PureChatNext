import type { DiscoverProviderItem } from '@/features/community/types'

export const COMMUNITY_PROVIDERS: DiscoverProviderItem[] = [
  {
    description:
      'OpenAI 是一家领先的 AI 研究实验室，其 GPT 模型推动了自然语言处理的发展，在研究、商业和创新领域提供高性能与强价值。',
    id: 'openai',
    identifier: 'openai',
    modelCount: 4,
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
    name: 'OpenAI',
    url: 'https://openai.com',
  },
  {
    description:
      'DeepSeek 专注于 AI 研究与应用。其最新 DeepSeek V4 系列提供 Flash 与 Pro 变体，具备 1M 上下文窗口与混合推理能力，在推理与智能体基准上可与领先闭源前沿模型竞争。',
    id: 'deepseek',
    identifier: 'deepseek',
    modelCount: 2,
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    name: 'DeepSeek',
    url: 'https://deepseek.com',
  },
]
