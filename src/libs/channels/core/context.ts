import type { ModelMessage } from 'ai'

import type { ChannelHistoryTurn } from './history'

export type { ChannelHistoryTurn } from './history'

export function buildChannelContextMessages(turns: ChannelHistoryTurn[]): ModelMessage[] {
  const messages: ModelMessage[] = []
  for (const turn of turns) {
    if (turn.content) messages.push({ content: turn.content, role: 'user' })
    if (turn.responseText) messages.push({ content: turn.responseText, role: 'assistant' })
  }
  return messages
}