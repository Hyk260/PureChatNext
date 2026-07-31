export type UsageItem = {
  cachedInputTokens: number | null
  createdAt: string
  credits: number
  durationMs: number | null
  id: string
  inputTokens: number | null
  model: string | null
  outputTokens: number | null
  provider: string | null
  totalTokens: number
}

export type UsageResponse = {
  balance: { grant: number; period: string; remaining: number; used: number }
  items: UsageItem[]
  models: string[]
  page: number
  pageSize: number
  total: number
  totalCredits: number
  storage: { limitBytes: number; usedBytes: number }
}
