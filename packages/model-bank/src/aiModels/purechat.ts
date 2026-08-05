import type { AiModelCard } from '../types/aiModel'

/**
 * PureChat 模型 + Gateway USD 定价。
 * 定价来自 AI Gateway `/v1/models`（每 token USD → 百万 tokens）；
 * 阶梯价取基础档。含核心名单 + 适合 $5 免费额度联调的廉价 tool-use 扩展模型。
 * 免费层可用性最后核验：2026-07-28，来源 https://vercel.com/ai-gateway/models?freeTier=true
 */
export const purechatChatModels: AiModelCard[] = [
  {
    id: 'gpt-5.4-mini',
    displayName: 'GPT 5.4 Mini',
    gatewayId: 'openai/gpt-5.4-mini',
    description: 'OpenAI 的 GPT-5.4 Mini —— 性能与成本的高效平衡。',
    enabled: true,
    recommended: true,
    family: 'gpt',
    contextWindowTokens: 400_000,
    maxOutput: 128_000,
    releasedAt: '2026-03-17',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.75,
      textOutput: 4.5,
      textInputCacheRead: 0.075,
    },
  },
  {
    id: 'gpt-5.4-nano',
    displayName: 'GPT 5.4 Nano',
    gatewayId: 'openai/gpt-5.4-nano',
    description: 'OpenAI 的 GPT-5.4 Nano —— 超轻量模型，适用于高吞吐任务。',
    enabled: true,
    family: 'gpt',
    contextWindowTokens: 400_000,
    maxOutput: 128_000,
    releasedAt: '2026-03-17',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.2,
      textOutput: 1.25,
      textInputCacheRead: 0.02,
    },
  },
  {
    id: 'gpt-5.2',
    displayName: 'GPT 5.2',
    gatewayId: 'openai/gpt-5.2',
    description: 'OpenAI 的 GPT-5.2，支持推理、视觉与工具调用。',
    enabled: true,
    family: 'gpt',
    contextWindowTokens: 400_000,
    maxOutput: 128_000,
    releasedAt: '2025-12-11',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 1.75,
      textOutput: 14,
      textInputCacheRead: 0.175,
    },
  },
  {
    id: 'claude-3-haiku',
    displayName: 'Claude 3 Haiku',
    gatewayId: 'anthropic/claude-3-haiku',
    description: 'Anthropic 的 Claude 3 Haiku，响应快速并支持视觉与工具调用。',
    enabled: true,
    family: 'claude',
    contextWindowTokens: 200_000,
    maxOutput: 4_096,
    releasedAt: '2024-03-13',
    abilities: {
      functionCall: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.25,
      textOutput: 1.25,
      textInputCacheRead: 0.03,
      textInputCacheWrite: 0.3,
    },
  },
  {
    id: 'deepseek-v3.2-thinking',
    displayName: 'DeepSeek V3.2 Thinking',
    gatewayId: 'deepseek/deepseek-v3.2-thinking',
    description: 'DeepSeek V3.2 的思考版本，适用于推理与工具调用任务。',
    enabled: true,
    family: 'deepseek',
    contextWindowTokens: 128_000,
    maxOutput: 8_000,
    releasedAt: '2025-12-01',
    abilities: {
      functionCall: true,
      reasoning: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.62,
      textOutput: 1.85,
    },
  },
  {
    id: 'qwen3.5-plus',
    displayName: 'Qwen 3.5 Plus',
    gatewayId: 'alibaba/qwen3.5-plus',
    description: 'Qwen 3.5 Plus，支持百万上下文、视觉、推理与工具调用。',
    enabled: true,
    family: 'qwen',
    contextWindowTokens: 1_000_000,
    maxOutput: 64_000,
    releasedAt: '2026-02-16',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.4,
      textOutput: 2.4,
      textInputCacheRead: 0.04,
      textInputCacheWrite: 0.5,
    },
  },
  {
    id: 'nova-2-lite',
    displayName: 'Nova 2 Lite',
    gatewayId: 'amazon/nova-2-lite',
    description: 'Amazon Nova 2 Lite，兼顾低成本、多模态输入和推理能力。',
    enabled: true,
    family: 'nova',
    contextWindowTokens: 1_000_000,
    maxOutput: 1_000_000,
    releasedAt: '2025-12-02',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.3,
      textOutput: 2.5,
      textInputCacheRead: 0.075,
    },
  },
  {
    id: 'kimi-k2.5',
    displayName: 'Kimi K2.5',
    gatewayId: 'moonshotai/kimi-k2.5',
    description: 'Moonshot AI 的 Kimi K2.5，支持视觉、推理与工具调用。',
    enabled: true,
    family: 'kimi',
    contextWindowTokens: 262_114,
    maxOutput: 262_114,
    releasedAt: '2026-01-26',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.6,
      textOutput: 3,
      textInputCacheRead: 0.1,
    },
  },
  {
    id: 'grok-4.1-fast-reasoning',
    displayName: 'Grok 4.1 Fast Reasoning',
    gatewayId: 'xai/grok-4.1-fast-reasoning',
    description: 'xAI 的 Grok 4.1 Fast 推理版本，支持百万上下文、视觉与工具调用。',
    enabled: true,
    family: 'grok',
    contextWindowTokens: 1_000_000,
    maxOutput: 1_000_000,
    releasedAt: '2025-11-19',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.2,
      textOutput: 0.5,
      textInputCacheRead: 0.05,
    },
  },
  {
    id: 'grok-4.1-fast-non-reasoning',
    displayName: 'Grok 4.1 Fast Non-Reasoning',
    gatewayId: 'xai/grok-4.1-fast-non-reasoning',
    description: 'xAI 的 Grok 4.1 Fast 非推理版本，适用于高速视觉与工具调用任务。',
    enabled: true,
    family: 'grok',
    contextWindowTokens: 1_000_000,
    maxOutput: 1_000_000,
    releasedAt: '2025-11-19',
    abilities: {
      functionCall: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.2,
      textOutput: 0.5,
      textInputCacheRead: 0.05,
    },
  },
  {
    id: 'glm-5-turbo',
    displayName: 'GLM 5 Turbo',
    gatewayId: 'zai/glm-5-turbo',
    description: '智谱 GLM 5 Turbo，面向高效推理与工具调用任务。',
    enabled: true,
    family: 'glm',
    contextWindowTokens: 202_800,
    maxOutput: 131_100,
    releasedAt: '2026-03-15',
    abilities: {
      functionCall: true,
      reasoning: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 1.2,
      textOutput: 4,
      textInputCacheRead: 0.24,
    },
  },
  {
    id: 'minimax-m2.7',
    displayName: 'MiniMax M2.7',
    gatewayId: 'minimax/minimax-m2.7',
    description: 'MiniMax M2.7，适用于推理、编码和工具调用。',
    enabled: true,
    family: 'minimax',
    contextWindowTokens: 204_800,
    maxOutput: 131_000,
    releasedAt: '2026-03-18',
    abilities: {
      functionCall: true,
      reasoning: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.3,
      textOutput: 1.2,
      textInputCacheRead: 0.06,
      textInputCacheWrite: 0.375,
    },
  },
  // Vercel AI Gateway 免费层暂不可用（最后核验：2026-07-28）。
  // 保留卡片与定价用于历史记录，恢复时只需重新启用。
  {
    id: 'gpt-5.5',
    displayName: 'GPT 5.5',
    gatewayId: 'openai/gpt-5.5',
    description: 'GPT-5.5 是我们最新的前沿模型，适用于最复杂的专业工作。',
    enabled: false,
    family: 'gpt',
    contextWindowTokens: 1_000_000,
    maxOutput: 128_000,
    releasedAt: '2026-04-24',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 5,
      textOutput: 30,
      textInputCacheRead: 0.5,
    },
  },
  {
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    gatewayId: 'anthropic/claude-sonnet-4.6',
    description: 'Anthropic 的 Claude Sonnet 4.6 —— 最新 Sonnet 模型，在编码与工具使用方面表现更强。',
    enabled: false,
    family: 'claude',
    contextWindowTokens: 1_000_000,
    maxOutput: 128_000,
    releasedAt: '2026-02-17',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 3,
      textOutput: 15,
      textInputCacheRead: 0.3,
      textInputCacheWrite: 3.75,
    },
  },
  {
    id: 'claude-haiku-4-5',
    displayName: 'Claude Haiku 4.5',
    gatewayId: 'anthropic/claude-haiku-4.5',
    description: 'Anthropic 的 Claude Haiku 4.5 —— 新一代 Haiku，具备更强推理与视觉能力。',
    enabled: false,
    family: 'claude',
    contextWindowTokens: 200_000,
    maxOutput: 64_000,
    releasedAt: '2025-10-15',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 1,
      textOutput: 5,
      textInputCacheRead: 0.1,
      textInputCacheWrite: 1.25,
    },
  },
  {
    id: 'gemini-3.1-pro-preview',
    displayName: 'Gemini 3.1 Pro Preview',
    gatewayId: 'google/gemini-3.1-pro-preview',
    description: 'Gemini 3.1 Pro Preview在Gemini 3 Pro的基础上增强了推理能力，并增加了中等思维水平支持。',
    enabled: false,
    family: 'gemini',
    contextWindowTokens: 1_000_000,
    maxOutput: 64_000,
    releasedAt: '2025-11-18',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 2,
      textOutput: 12,
      textInputCacheRead: 0.2,
    },
  },
  {
    id: 'gemini-3-flash',
    displayName: 'Gemini 3 Flash',
    gatewayId: 'google/gemini-3-flash',
    description: 'Google 的 Gemini 3 Flash —— 超高速模型，支持多模态输入。',
    enabled: false,
    family: 'gemini',
    contextWindowTokens: 1_000_000,
    maxOutput: 65_000,
    releasedAt: '2025-12-17',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.5,
      textOutput: 3,
      textInputCacheRead: 0.05,
    },
  },
  {
    id: 'deepseek-v4-pro',
    displayName: 'DeepSeek V4 Pro',
    gatewayId: 'deepseek/deepseek-v4-pro',
    description:
      'DeepSeek-V4-Pro是DeepSeek基于Volcano Ark的旗舰MoE模型，支持非思维模式和思维模式，用于高级推理、代码生成和复杂代理工作流。',
    enabled: false,
    family: 'deepseek',
    contextWindowTokens: 1_000_000,
    maxOutput: 384_000,
    releasedAt: '2026-04-23',
    abilities: {
      functionCall: true,
      reasoning: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.435,
      textOutput: 0.87,
      textInputCacheRead: 0.0036,
    },
  },
  {
    id: 'deepseek-v4-flash',
    displayName: 'DeepSeek V4 Flash',
    gatewayId: 'deepseek/deepseek-v4-flash',
    description:
      'DeepSeek-V4-Flash是DeepSeek基于Volcano Ark的高效100万上下文模型，兼顾速度与成本，同时保持强大的推理和代理能力。',
    enabled: false,
    family: 'deepseek',
    contextWindowTokens: 1_000_000,
    maxOutput: 384_000,
    releasedAt: '2026-04-23',
    abilities: {
      functionCall: true,
      reasoning: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.14,
      textOutput: 0.28,
      textInputCacheRead: 0.028,
    },
  },
  {
    id: 'glm-5.2',
    displayName: 'GLM 5.2',
    gatewayId: 'zai/glm-5.2',
    description:
      'GLM系列是智谱AI为智能代理打造的混合推理模型，具备思考模式和非思考模式。GLM-5.2是智谱在长周期任务时代的旗舰模型，支持1百万个Token的上下文，并针对长周期规划、复杂编程和代理执行进行了优化。',
    enabled: false,
    family: 'glm',
    contextWindowTokens: 1_040_000,
    maxOutput: 128_000,
    releasedAt: '2026-06-16',
    abilities: {
      functionCall: true,
      reasoning: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 1.4,
      textOutput: 4.4,
      textInputCacheRead: 0.26,
    },
  },
  {
    id: 'step-3.7-flash',
    displayName: 'Step 3.7 Flash',
    gatewayId: 'stepfun/step-3.7-flash',
    description:
      'StepFun的旗舰多模态推理模型。基于step-3.5-flash的高速推理和工具调用能力，增加了原生多模态输入支持，能够直接理解图像和视频内容，无需依赖视觉MCP或额外的视觉模型。该模型支持三种推理级别（低/中/高），是代理工作流、编码任务和多模态应用的快速可靠选择。',
    enabled: true,
    family: 'step',
    contextWindowTokens: 256_000,
    maxOutput: 256_000,
    releasedAt: '2026-05-28',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.2,
      textOutput: 1.15,
      textInputCacheRead: 0.04,
    },
  },
  {
    id: 'minimax-m3',
    displayName: 'MiniMax M3',
    gatewayId: 'minimax/minimax-m3',
    description: 'MiniMax M3——最新的MiniMax模型，支持视觉功能，具有强大的推理能力和改进的工具使用。',
    enabled: true,
    family: 'minimax',
    contextWindowTokens: 1_000_000,
    maxOutput: 1_000_000,
    releasedAt: '2026-05-31',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.3,
      textOutput: 1.2,
      textInputCacheRead: 0.06,
    },
  },
  {
    id: 'gpt-5-nano',
    displayName: 'GPT-5 nano',
    gatewayId: 'openai/gpt-5-nano',
    description: 'OpenAI 的 GPT-5 Nano —— 轻量级高性价比模型。',
    enabled: true,
    family: 'gpt',
    contextWindowTokens: 400_000,
    maxOutput: 128_000,
    releasedAt: '2025-08-07',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.05,
      textOutput: 0.4,
      textInputCacheRead: 0.005,
    },
  },
  {
    id: 'gpt-4.1-nano',
    displayName: 'GPT-4.1 nano',
    gatewayId: 'openai/gpt-4.1-nano',
    description: 'GPT-4.1 nano 是最快且最具性价比的 GPT-4.1 模型。',
    enabled: true,
    family: 'gpt',
    contextWindowTokens: 1_047_576,
    maxOutput: 32_768,
    releasedAt: '2025-04-14',
    abilities: {
      functionCall: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.1,
      textOutput: 0.4,
      textInputCacheRead: 0.025,
    },
  },
  {
    id: 'gpt-oss-20b',
    displayName: 'GPT OSS 20B',
    gatewayId: 'openai/gpt-oss-20b',
    description: '需申请访问。GPT-OSS-20B 是 OpenAI 开源的中型语言模型，具备高效的文本生成能力。',
    enabled: true,
    family: 'gpt',
    contextWindowTokens: 131_072,
    maxOutput: 8_192,
    releasedAt: '2025-08-05',
    abilities: {
      functionCall: true,
      reasoning: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.05,
      textOutput: 0.2,
    },
  },
  {
    id: 'gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash Lite',
    gatewayId: 'google/gemini-2.5-flash-lite',
    description: 'Gemini 2.5 Flash-Lite 是 Google 最小、性价比最高的模型，适用于大规模使用场景。',
    enabled: true,
    family: 'gemini',
    contextWindowTokens: 1_048_576,
    maxOutput: 65_536,
    releasedAt: '2025-06-17',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.1,
      textOutput: 0.4,
      textInputCacheRead: 0.01,
    },
  },
  {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    gatewayId: 'google/gemini-2.5-flash',
    description: 'Gemini 2.5 Flash 是 Google 功能最全、性价比最高的模型。',
    enabled: true,
    family: 'gemini',
    contextWindowTokens: 1_000_000,
    maxOutput: 65_536,
    releasedAt: '2025-03-20',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.3,
      textOutput: 2.5,
      textInputCacheRead: 0.03,
    },
  },
  {
    id: 'nova-micro',
    displayName: 'Nova Micro',
    gatewayId: 'amazon/nova-micro',
    description: '一款仅支持文本的模型，具备超低延迟和极低成本。',
    enabled: true,
    family: 'nova',
    contextWindowTokens: 128_000,
    maxOutput: 8_192,
    releasedAt: '2024-12-03',
    abilities: {
      functionCall: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.035,
      textOutput: 0.14,
    },
  },
  {
    id: 'nova-lite',
    displayName: 'Nova Lite',
    gatewayId: 'amazon/nova-lite',
    description: '一款极低成本的多模态模型，能够以极快速度处理图像、视频和文本输入。',
    enabled: true,
    family: 'nova',
    contextWindowTokens: 300_000,
    maxOutput: 8_192,
    releasedAt: '2024-12-03',
    abilities: {
      functionCall: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.06,
      textOutput: 0.24,
    },
  },
  {
    id: 'qwen3.5-flash',
    displayName: 'Qwen 3.5 Flash',
    gatewayId: 'alibaba/qwen3.5-flash',
    description:
      'Qwen3.5 原生视觉语言 Flash 模型基于线性注意力机制与稀疏 Mixture-of-Experts（MoE）混合架构构建，推理效率更高。相较于 3 系列，无论在纯文本任务还是多模态任务上均有大幅性能提升，同时具备更快响应速度，在推理速度与整体能力之间实现良好平衡。',
    enabled: true,
    family: 'qwen',
    contextWindowTokens: 1_000_000,
    maxOutput: 64_000,
    releasedAt: '2026-02-24',
    abilities: {
      functionCall: true,
      reasoning: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.1,
      textOutput: 0.4,
      textInputCacheRead: 0.001,
      textInputCacheWrite: 0.125,
    },
  },
  {
    id: 'mistral-small',
    displayName: 'Mistral Small',
    gatewayId: 'mistral/mistral-small',
    description: 'Mistral Small 适用于任何需要高效率和低延迟的语言任务。',
    enabled: true,
    family: 'mistral',
    contextWindowTokens: 32_000,
    maxOutput: 4_000,
    releasedAt: '2024-09-17',
    abilities: {
      functionCall: true,
      vision: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.1,
      textOutput: 0.3,
    },
  },
  {
    id: 'glm-4.7-flash',
    displayName: 'GLM 4.7 Flash',
    gatewayId: 'zai/glm-4.7-flash',
    description:
      'GLM-4.7-Flash 是一款 30B 级别的 SOTA 模型，在性能与效率之间实现平衡。它提升了编程能力、长期任务规划和工具协作能力，适用于 Agentic Coding 场景，在多个当前基准排行榜中，在同体量开源模型中表现领先。在执行复杂智能体任务时，工具调用的指令遵循性更强，进一步提升了 Artifacts 和 Agentic Coding 的前端美学和长期任务完成效率。',
    enabled: true,
    family: 'glm',
    contextWindowTokens: 200_000,
    maxOutput: 131_000,
    releasedAt: '2026-01-19',
    abilities: {
      functionCall: true,
      reasoning: true,
    },
    pricing: {
      currency: 'USD',
      textInput: 0.07,
      textOutput: 0.4,
    },
  },
]

export const PURECHAT_DEFAULT_MODEL = 'gpt-5.4-mini'

export const PURECHAT_PLAN_CARD_MODELS = ['gpt-5.2', 'qwen3.5-plus', 'kimi-k2.5', 'grok-4.1-fast-reasoning'] as const

const byId = new Map(purechatChatModels.map((m) => [m.id, m]))
const byGatewayId = new Map(purechatChatModels.filter((m) => m.gatewayId).map((m) => [m.gatewayId!, m]))

/** 面向用户和新请求的可用模型；完整目录仍保留暂时禁用模型。 */
export const purechatEnabledChatModels = purechatChatModels.filter((model) => model.enabled !== false)

const enabledById = new Map(purechatEnabledChatModels.map((model) => [model.id, model]))

export const getPureChatModel = (displayId: string) => byId.get(displayId)

export const getEnabledPureChatModel = (displayId: string) => enabledById.get(displayId)

export const resolvePureChatGatewayId = (displayId: string): string | undefined => byId.get(displayId)?.gatewayId

export const resolvePureChatDisplayId = (gatewayId: string): string | undefined => byGatewayId.get(gatewayId)?.id

/** 缺价模型禁止上线 */
export const assertPureChatPricingComplete = () => {
  for (const model of purechatChatModels) {
    if (!(model.pricing.textInput > 0) || !(model.pricing.textOutput > 0)) {
      throw new Error(`PureChat model "${model.id}" missing pricing`)
    }
    if (model.pricing.currency !== 'USD') {
      throw new Error(`PureChat model "${model.id}" must use USD pricing`)
    }
    if (!model.gatewayId) {
      throw new Error(`PureChat model "${model.id}" missing gatewayId`)
    }
  }
}
