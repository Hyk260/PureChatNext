import type { AiModelCard } from '../types/aiModel'

/**
 * DeepSeek 自配模型卡（CNY / 百万 tokens）。
 *
 * 文档：
 * - 模型 & 价格：https://api-docs.deepseek.com/zh-cn/quick_start/pricing
 * - 更新日志：https://api-docs.deepseek.com/updates/
 * - 思考模式：https://api-docs.deepseek.com/zh-cn/guides/thinking_mode
 * - 图像理解：https://api-docs.deepseek.com/zh-cn/guides/vision_faq
 *
 * 定价说明（2026-08-17 起生效）：官方分空闲/高峰两档，高峰 = 空闲 × 2。
 * 本卡 `pricing` 取空闲时段单价（工作日 9–12、14–18 北京时间为高峰）。
 * Peak hours UTC：周一至周五 01:00–04:00、06:00–10:00。
 */
export const deepseekChatModels: AiModelCard[] = [
  {
    id: 'deepseek-v4-flash',
    displayName: 'DeepSeek V4 Flash',
    // 版本 DeepSeek-V4-Flash-0731；284B total / 13B active MoE
    description:
      'DeepSeek-V4-Flash（0731）是 V4 系列的高性价比模型，1M 上下文，默认思考模式可切换，兼顾延迟与 Agent/推理能力。',
    enabled: true,
    family: 'deepseek',
    generation: 'deepseek-v4',
    contextWindowTokens: 1_048_576,
    maxOutput: 393_216,
    // Preview 2026-04-24；正式版 API（0731）2026-07-31
    releasedAt: '2026-07-31',
    abilities: {
      functionCall: true,
      reasoning: true,
      structuredOutput: true,
    },
    // 空闲：输入 1.5 / 输出 4.5 / 缓存命中 0.05；高峰：3.0 / 9.0 / 0.10
    pricing: {
      currency: 'CNY',
      textInput: 1.5,
      textOutput: 4.5,
      textInputCacheRead: 0.05,
    },
  },
  {
    id: 'deepseek-v4-flash-vision-exp',
    displayName: 'DeepSeek V4 Flash Vision Exp',
    // 实验性多模态；纯文本能力对齐 V4-Flash；图像按尺寸换算为输入 tokens（单图最多 384）
    description:
      'DeepSeek-V4-Flash-Vision-Exp 是实验性多模态模型，在 V4 Flash 同级定价下支持图文理解；支持 JPEG/PNG/GIF/WebP，图像按输入 tokens 计费（单图最多 384 tokens）。',
    enabled: true,
    family: 'deepseek',
    generation: 'deepseek-v4',
    contextWindowTokens: 1_048_576,
    maxOutput: 393_216,
    releasedAt: '2026-08-21',
    abilities: {
      functionCall: true,
      reasoning: true,
      structuredOutput: true,
      vision: true,
    },
    // 与 deepseek-v4-flash 同价（空闲档）
    pricing: {
      currency: 'CNY',
      textInput: 1.5,
      textOutput: 4.5,
      textInputCacheRead: 0.05,
    },
  },
  {
    id: 'deepseek-v4-pro',
    displayName: 'DeepSeek V4 Pro',
    // 版本 DeepSeek-V4-Pro-0813 GA；1.6T total / 49B active MoE
    description:
      'DeepSeek-V4-Pro（0813）是 V4 系列旗舰 MoE，1M 上下文，默认思考模式可切换，面向高级推理、代码生成与复杂 Agent 工作流。',
    enabled: true,
    family: 'deepseek',
    generation: 'deepseek-v4',
    contextWindowTokens: 1_048_576,
    maxOutput: 393_216,
    // Preview 2026-04-24；GA（0813）2026-08-13
    releasedAt: '2026-08-13',
    abilities: {
      functionCall: true,
      reasoning: true,
      structuredOutput: true,
    },
    // 空闲：输入 4.5 / 输出 13.5 / 缓存命中 0.15；高峰：9.0 / 27.0 / 0.30
    pricing: {
      currency: 'CNY',
      textInput: 4.5,
      textOutput: 13.5,
      textInputCacheRead: 0.15,
    },
  },
]

const byId = new Map(deepseekChatModels.map((m) => [m.id, m]))

export const getDeepSeekModel = (id: string) => byId.get(id)
