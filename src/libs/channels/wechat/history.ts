import { getAiModel } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'
import { estimateTokenCount, sliceByTokens } from '@pure/utils'

const DEFAULT_CONTEXT_WINDOW_TOKENS = 128_000
const MAX_CONVERSATION_TOKENS = 12_000
const OUTPUT_SAFETY_TOKENS = 4096

export type WechatHistoryTurn = { content: string; responseText: string | null }

export function getWechatHistoryTokenBudget(provider: string, modelId: string, userText: string): number {
  const contextWindow =
    getAiModel(provider as ModelProviderId, modelId)?.contextWindowTokens ?? DEFAULT_CONTEXT_WINDOW_TOKENS
  const conversationBudget = Math.min(MAX_CONVERSATION_TOKENS, Math.floor(contextWindow * 0.1))
  return Math.max(0, conversationBudget - estimateTokenCount(userText) - OUTPUT_SAFETY_TOKENS)
}

function countTurnTokens(turn: WechatHistoryTurn): number {
  return estimateTokenCount(turn.content) + estimateTokenCount(turn.responseText ?? '')
}

function tailTruncateTurn(turn: WechatHistoryTurn, budget: number): WechatHistoryTurn {
  const responseText = turn.responseText ?? ''
  const responseTokens = estimateTokenCount(responseText)
  if (responseTokens >= budget) {
    return { content: '', responseText: sliceByTokens(responseText, -budget) || null }
  }

  const contentBudget = budget - responseTokens
  return {
    content: sliceByTokens(turn.content, -contentBudget),
    responseText: turn.responseText,
  }
}

/** Keeps recent complete turns; only a newest turn that cannot fit alone may be tail-truncated. */
export function trimWechatHistory(rows: WechatHistoryTurn[], budget: number): WechatHistoryTurn[] {
  let remaining = Math.max(0, Math.floor(budget))
  if (!remaining) return []

  const selected: WechatHistoryTurn[] = []
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]!
    const tokens = countTurnTokens(row)
    if (tokens > remaining) {
      if (selected.length === 0) selected.unshift(tailTruncateTurn(row, remaining))
      break
    }
    selected.unshift(row)
    remaining -= tokens
  }
  return selected
}
