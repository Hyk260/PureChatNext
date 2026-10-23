import { DEFAULT_CHAT_ADVANCED_SETTINGS } from '@pure/types'
import type { ChatAdvancedSettings } from '@pure/types'
import type { UIMessage } from 'ai'
import { isToolUIPart } from 'ai'
import { z } from 'zod'

export const MAX_HISTORY_COUNT = 1000
export const MAX_INPUT_TEMPLATE_LENGTH = 10_000
const INPUT_PLACEHOLDER = /\{\{\s*text\s*\}\}/g

export const chatAdvancedSettingsSchema = z
  .object({
    enableContextCompression: z.boolean().default(DEFAULT_CHAT_ADVANCED_SETTINGS.enableContextCompression),
    enableHistoryCount: z.boolean().default(DEFAULT_CHAT_ADVANCED_SETTINGS.enableHistoryCount),
    historyCount: z.number().int().min(0).max(MAX_HISTORY_COUNT).default(DEFAULT_CHAT_ADVANCED_SETTINGS.historyCount),
    inputTemplate: z.string().max(MAX_INPUT_TEMPLATE_LENGTH).default(''),
  })
  .strict()

export const chatContextSummarySchema = z.object({
  text: z.string().min(1).max(24_000),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  messageCount: z.number().int().positive().max(MAX_HISTORY_COUNT),
})

export const hasInputPlaceholder = (template: string) => /\{\{\s*text\s*\}\}/.test(template)

export const getChatSettingsKey = (userId: string, agentId: string) => JSON.stringify([userId, agentId])

/** Keep the current user/tool turn intact; limiting context never changes stored messages. */
export function selectChatHistory(messages: UIMessage[], settings: ChatAdvancedSettings): UIMessage[] {
  if (!settings.enableHistoryCount) return messages
  const currentTurn = messages.findLastIndex((message) => message.role === 'user')
  if (currentTurn < 0) return messages
  let start = Math.max(0, currentTurn - settings.historyCount)
  const boundary = messages[start]
  if (boundary?.role === 'assistant' && boundary.parts.some(isToolUIPart)) {
    while (start > 0 && messages[start].role !== 'user') start -= 1
  }
  return messages.slice(start)
}

export function applyInputTemplate(messages: UIMessage[], template: string): UIMessage[] {
  if (!template.trim()) return messages
  const latestUser = messages.findLastIndex((message) => message.role === 'user')
  if (latestUser < 0) return messages
  return messages.map((message, index) => {
    if (index !== latestUser) return message
    const text = message.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n')
    return {
      ...message,
      parts: [
        { type: 'text' as const, text: template.replace(INPUT_PLACEHOLDER, () => text) },
        ...message.parts.filter((part) => part.type !== 'text'),
      ],
    }
  })
}
