import { estimateTokenCount } from '@pure/utils'
import { describe, expect, it } from 'vitest'

import { getChannelHistoryTokenBudget, trimChannelHistory } from '../../core/history'

describe('getChannelHistoryTokenBudget', () => {
  it('caps a catalog model conversation at 12k and reserves output plus the current prompt', () => {
    const prompt = '请继续分析这段对话'
    expect(getChannelHistoryTokenBudget('deepseek', 'deepseek-v4-flash', prompt)).toBe(
      12_000 - 4096 - estimateTokenCount(prompt)
    )
  })

  it('uses a 128k fallback window for unknown model metadata', () => {
    expect(getChannelHistoryTokenBudget('openai', 'unknown-model', '')).toBe(12_000 - 4096)
  })
})

describe('trimChannelHistory', () => {
  const turns = [
    { content: 'old question', responseText: 'old answer' },
    { content: 'middle question', responseText: 'middle answer' },
    { content: 'new question', responseText: 'new answer' },
  ]

  it('keeps whole recent turns within the token budget', () => {
    const budget =
      estimateTokenCount(turns[1]!.content) +
      estimateTokenCount(turns[1]!.responseText!) +
      estimateTokenCount(turns[2]!.content) +
      estimateTokenCount(turns[2]!.responseText!)
    expect(trimChannelHistory(turns, budget)).toEqual(turns.slice(1))
  })

  it('does not partially include an older turn after accepting a newer whole turn', () => {
    const newestBudget = estimateTokenCount(turns[2]!.content) + estimateTokenCount(turns[2]!.responseText!)
    expect(trimChannelHistory(turns, newestBudget + 1)).toEqual([turns[2]])
  })

  it('tail-truncates only a newest turn that cannot fit by itself', () => {
    const oversized = { content: 'prefix '.repeat(100), responseText: 'answer-tail '.repeat(100) }
    const [trimmed] = trimChannelHistory([oversized], 20)
    expect(trimmed).toBeDefined()
    expect(trimmed!.content).toBe('')
    expect(trimmed!.responseText).toMatch(/answer-tail\s*$/)
    expect(estimateTokenCount(trimmed!.responseText!)).toBeLessThanOrEqual(20)
  })
})
