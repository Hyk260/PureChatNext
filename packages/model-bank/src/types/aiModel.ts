/** 模型定价 / 目录共享类型（对齐需求文档 Pricing 语义，本仓轻量实现）。 */

export type PricingCurrency = 'CNY' | 'USD'

/**
 * 固定单价（USD 或 CNY / 百万 tokens）。
 * PureHub 一律 USD；deepseek 自配卡保留官方 CNY。
 */
export type ModelTokenPricing = {
  currency: PricingCurrency
  /** 每百万 tokens */
  textInput: number
  textOutput: number
  textInputCacheRead?: number
  textInputCacheWrite?: number
}

/** 模型能力开关 */
export type ModelAbilities = {
  functionCall?: boolean
  reasoning?: boolean
  structuredOutput?: boolean
  vision?: boolean
}

export type AiModelCard = {
  /** UI / 请求体使用的短 id */
  id: string
  displayName: string
  /** PureHub：Gateway `vendor/model`；自配服务商可省略（= id） */
  gatewayId?: string
  pricing: ModelTokenPricing
  enabled?: boolean
  recommended?: boolean
  /** 上下文窗口（input + output 上限量级） */
  contextWindowTokens?: number
  /** 单次最大输出 tokens */
  maxOutput?: number
  description?: string
  abilities?: ModelAbilities
  /** 产品线，如 deepseek / gpt */
  family?: string
  /** 代际，如 deepseek-v4 */
  generation?: string
  /** 发布日期 YYYY-MM-DD */
  releasedAt?: string
}

export type ModelProviderCard = {
  id: string
  name: string
  description: string
  enabled: boolean
  /** 是否向用户展示 API Key / baseURL 配置 */
  showConfig: boolean
  settings?: {
    modelEditable?: boolean
    showAddNewModel?: boolean
    showModelFetcher?: boolean
  }
  url?: string
}
