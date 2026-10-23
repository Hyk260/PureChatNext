import type { UIMessage } from 'ai'
import { DEFAULT_CHAT_ADVANCED_SETTINGS } from '@pure/types'
import { describe, expect, it } from 'vitest'

import { applyInputTemplate, chatAdvancedSettingsSchema, selectChatHistory } from '../advancedSettings'

const messages: UIMessage[] = [
  { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'older question' }] },
  { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'older answer' }] },
  {
    id: 'u2',
    role: 'user',
    parts: [
      { type: 'text', text: 'latest $& {{text}}' },
      { type: 'file', filename: 'a.png', mediaType: 'image/png', url: 'data:image/png;base64,AA==' },
    ],
  },
]

describe('advanced chat context settings', () => {
  it('limits outbound history, including zero, without changing stored messages', () => {
    const original = structuredClone(messages)
    const limited = { ...DEFAULT_CHAT_ADVANCED_SETTINGS, enableHistoryCount: true, historyCount: 1 }
    expect(selectChatHistory(messages, limited).map(({ id }) => id)).toEqual(['a1', 'u2'])
    expect(selectChatHistory(messages, { ...limited, historyCount: 0 }).map(({ id }) => id)).toEqual(['u2'])
    expect(selectChatHistory(messages, DEFAULT_CHAT_ADVANCED_SETTINGS)).toBe(messages)
    expect(messages).toEqual(original)
  })

  it('keeps the current tool continuation and any required boundary turn intact', () => {
    const tool: UIMessage = {
      id: 'tool',
      role: 'assistant',
      parts: [{ type: 'tool-readFile', toolCallId: 'call', input: {}, output: 'data', state: 'output-available' }],
    }
    const history = [messages[0], tool, messages[2], { ...tool, id: 'current-tool' }]
    expect(
      selectChatHistory(history, { ...DEFAULT_CHAT_ADVANCED_SETTINGS, enableHistoryCount: true, historyCount: 1 })
    ).toEqual(history)
    expect(
      selectChatHistory(history, { ...DEFAULT_CHAT_ADVANCED_SETTINGS, enableHistoryCount: true, historyCount: 0 })
    ).toEqual(history.slice(2))
  })

  it('templates the latest raw user text exactly once and preserves attachments and earlier turns', () => {
    const original = structuredClone(messages)
    const transformed = applyInputTemplate(messages, '翻译：{{ text }}\n原文：{{text}}')
    expect(transformed[0]).toBe(messages[0])
    expect(transformed[2].parts).toEqual([
      { type: 'text', text: '翻译：latest $& {{text}}\n原文：latest $& {{text}}' },
      messages[2].parts[1],
    ])
    expect(applyInputTemplate(messages, '翻译：{{text}}')[2].parts[0]).toEqual({
      type: 'text',
      text: '翻译：latest $& {{text}}',
    })
    expect(messages).toEqual(original)
  })

  it('validates counts and template sizes at the request boundary', () => {
    expect(chatAdvancedSettingsSchema.parse({})).toEqual(DEFAULT_CHAT_ADVANCED_SETTINGS)
    for (const historyCount of [-1, 0.5, 1001, '20']) {
      expect(chatAdvancedSettingsSchema.safeParse({ historyCount }).success).toBe(false)
    }
    expect(chatAdvancedSettingsSchema.safeParse({ enableContextCompression: 'true' }).success).toBe(false)
    expect(chatAdvancedSettingsSchema.safeParse({ inputTemplate: 'a'.repeat(10_001) }).success).toBe(false)
  })
})
