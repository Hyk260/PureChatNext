import { type DiscoverModelItem } from '@/features/community/types'

export const COMMUNITY_MODELS: DiscoverModelItem[] = [
  {
    description: 'GPT-4o 是 OpenAI 的多模态旗舰模型，支持文本与图像输入，在复杂推理、编程与跨领域任务上表现出色。',
    displayName: 'GPT-4o',
    id: 'gpt-4o',
    identifier: 'gpt-4o',
    providers: ['openai'],
  },
  {
    description: 'GPT-4o Mini 是更小、更高效的模型，在成本与速度上更具优势，同时保持接近 GPT-4o 的能力水平。',
    displayName: 'GPT-4o Mini',
    id: 'gpt-4o-mini',
    identifier: 'gpt-4o-mini',
    providers: ['openai'],
  },
  {
    description: 'o1 是 OpenAI 的推理模型，在回答前进行深度思考，擅长复杂推理、数学与科学类任务。',
    displayName: 'OpenAI o1',
    id: 'o1',
    identifier: 'o1',
    providers: ['openai'],
  },
  {
    description: 'o3-mini 是更快、更经济的推理模型，面向编程、数学与科学场景，在性能与成本之间取得平衡。',
    displayName: 'OpenAI o3-mini',
    id: 'o3-mini',
    identifier: 'o3-mini',
    providers: ['openai'],
  },
  {
    description:
      'DeepSeek V4 Flash 是 DeepSeek 的高速 1M 上下文旗舰模型，支持非思考与思考双模式，具备较强的智能体能力。',
    displayName: 'DeepSeek V4 Flash',
    id: 'deepseek-v4-flash',
    identifier: 'deepseek-v4-flash',
    providers: ['deepseek'],
  },
  {
    description:
      'DeepSeek V4 Pro 是 DeepSeek 能力最强的 1M 上下文旗舰模型，支持非思考与思考双模式，擅长高阶推理与工具调用。',
    displayName: 'DeepSeek V4 Pro',
    id: 'deepseek-v4-pro',
    identifier: 'deepseek-v4-pro',
    providers: ['deepseek'],
  },
]
