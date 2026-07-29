import { type AiModelCard } from '../types/aiModel'

export const deepseekChatModels: AiModelCard[] = [
  {
    id: 'deepseek-v4-flash',
    displayName: 'DeepSeek V4 Flash',
    description:
      'DeepSeek-V4-Flash是DeepSeek基于Volcano Ark的高效100万上下文模型，兼顾速度与成本，同时保持强大的推理和代理能力。',
    enabled: true,
    family: 'deepseek',
    generation: 'deepseek-v4',
    contextWindowTokens: 1_048_576,
    maxOutput: 393_216,
    releasedAt: '2026-04-24',
    abilities: {
      functionCall: true,
      reasoning: true,
      structuredOutput: true,
    },
    pricing: {
      currency: 'CNY',
      // Official cache-hit input price is permanently reduced to 1/10 of the launch price.
      textInput: 1,
      textOutput: 2,
      textInputCacheRead: 0.02,
    },
  },
  {
    id: 'deepseek-v4-pro',
    displayName: 'DeepSeek V4 Pro',
    description:
      'DeepSeek-V4-Pro是DeepSeek基于Volcano Ark的旗舰MoE模型，支持非思维模式和思维模式，用于高级推理、代码生成和复杂代理工作流。',
    enabled: true,
    family: 'deepseek',
    generation: 'deepseek-v4',
    contextWindowTokens: 1_048_576,
    maxOutput: 393_216,
    releasedAt: '2026-04-24',
    abilities: {
      functionCall: true,
      reasoning: true,
      structuredOutput: true,
    },
    pricing: {
      currency: 'CNY',
      // Official cache-hit input price is permanently reduced to 1/10 of the launch price.
      textInput: 3,
      textOutput: 6,
      textInputCacheRead: 0.025,
    },
  },
]

const byId = new Map(deepseekChatModels.map((m) => [m.id, m]))

export const getDeepSeekModel = (id: string) => byId.get(id)
