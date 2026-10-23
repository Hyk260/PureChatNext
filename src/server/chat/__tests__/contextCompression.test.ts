// @vitest-environment node
import * as ai from 'ai'
import type { UIMessage } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { DEFAULT_CHAT_ADVANCED_SETTINGS } from '@pure/types'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/server/search/userSettings', () => ({
  createUserSearchService: vi.fn(),
  loadWebSearchSettings: vi.fn(),
}))

import { hashContextMessages, prepareChatContext } from '../contextCompression'

const history = (count = 8): UIMessage[] =>
  Array.from({ length: count }, (_, index) => ({
    id: String(index),
    role: index % 2 === 0 ? 'user' : 'assistant',
    parts: [{ type: 'text', text: `message ${index} `.repeat(250) }],
  }))

const prepare = (messages: UIMessage[], overrides: Partial<Parameters<typeof prepareChatContext>[0]> = {}) =>
  prepareChatContext({
    messages,
    settings: DEFAULT_CHAT_ADVANCED_SETTINGS,
    model: new MockLanguageModelV4(),
    contextWindow: 6000,
    instructions: 'system instructions',
    nativeSearch: false,
    normalizeMessages: async (input) => input,
    ...overrides,
  })

const mockModel = (text = 'new summary') => {
  const generated = vi.fn(async () => ({
    content: [{ type: 'text' as const, text }],
    finishReason: { unified: 'stop' as const, raw: 'stop' },
    usage: {
      inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 20, text: 20, reasoning: 0 },
    },
    warnings: [],
  }))
  return { generated, model: new MockLanguageModelV4({ doGenerate: generated }) }
}

afterEach(() => vi.restoreAllMocks())

describe('context compression', () => {
  it('summarizes older turns with the real SDK, records usage, and keeps the recent turns unchanged', async () => {
    const source = history()
    source[5].parts.push({
      type: 'tool-readFile',
      toolCallId: 'recent-tool',
      input: {},
      output: 'retained tool output',
      state: 'output-available',
    })
    const snapshot = structuredClone(source)
    const settled = vi.fn().mockResolvedValue(undefined)
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: 'text', text: 'Preserved task facts' }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 20, text: 20, reasoning: 0 },
        },
        warnings: [],
      }),
    })
    const result = await prepare(source, { model, onSummaryUsage: settled })
    expect(result.summary).toMatchObject({
      text: 'Preserved task facts',
      messageCount: 4,
      sourceHash: hashContextMessages(source.slice(0, 4)),
    })
    expect(result.messages.slice(1)).toEqual(await ai.convertToModelMessages(source.slice(4)))
    expect(settled).toHaveBeenCalledWith(expect.objectContaining({ inputTokens: 100, outputTokens: 20 }))
    expect(source).toEqual(snapshot)
  })

  it('reuses a persisted summary on reload and invalidates it after source edits or deletes', async () => {
    const source = history()
    const contextSummary = {
      text: 'cached summary',
      messageCount: 4,
      sourceHash: hashContextMessages(source.slice(0, 4)),
    }
    source[7] = { ...source[7], metadata: { contextSummary } }
    const { generated, model } = mockModel()
    const restored = await prepare(structuredClone(source), { model })
    expect(restored.summary).toEqual(contextSummary)
    expect(generated).not.toHaveBeenCalled()

    const edited = structuredClone(source)
    edited[0].parts = [{ type: 'text', text: 'changed source' }]
    const changed = await prepare(edited, { model })
    expect(changed.summary?.text).toBe('new summary')
    expect(changed.summary?.sourceHash).not.toBe(contextSummary.sourceHash)
    generated.mockClear()
    await prepare(
      source.filter((message) => message.id !== '0'),
      { model }
    )
    expect(generated).toHaveBeenCalled()
  })

  it('never resurrects excluded history through a cached summary, and supports disabling compression', async () => {
    const source = history()
    source[7] = {
      ...source[7],
      metadata: {
        contextSummary: {
          text: 'secret from old history',
          messageCount: 4,
          sourceHash: hashContextMessages(source.slice(0, 4)),
        },
      },
    }
    const { generated, model } = mockModel()
    const limited = await prepare(source, {
      model,
      settings: { ...DEFAULT_CHAT_ADVANCED_SETTINGS, enableHistoryCount: true, historyCount: 0 },
    })
    expect(limited.summary).toBeUndefined()
    expect(JSON.stringify(limited.messages)).not.toContain('secret from old history')
    expect(limited.messages).toEqual(await ai.convertToModelMessages(source.slice(6)))
    const disabled = await prepare(source, {
      model,
      settings: { ...DEFAULT_CHAT_ADVANCED_SETTINGS, enableContextCompression: false },
    })
    expect(disabled.summary).toBeUndefined()
    expect(disabled.messages).toEqual(await ai.convertToModelMessages(source))
    expect(generated).not.toHaveBeenCalled()
  })

  it('does not repeatedly compress a short tail simply because the stored conversation is long', async () => {
    const source = history(164).map((message) => ({ ...message, parts: [{ type: 'text' as const, text: 'short' }] }))
    source[163] = {
      ...source[163],
      metadata: {
        contextSummary: { text: 'cached', messageCount: 160, sourceHash: hashContextMessages(source.slice(0, 160)) },
      },
    }
    const { generated, model } = mockModel()
    const result = await prepare(source, { model })
    expect(result.messages.length).toBe(5)
    expect(generated).not.toHaveBeenCalled()
  })

  it('stops on cancellation, empty summaries and overlong current input without modifying history', async () => {
    const source = history()
    const aborted = new AbortController()
    aborted.abort()
    const { generated, model } = mockModel('')
    await expect(prepare(source, { model, signal: aborted.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(generated).not.toHaveBeenCalled()
    await expect(prepare(source, { model })).rejects.toMatchObject({ cause: expect.stringContaining('有效摘要') })
    expect(source).toEqual(history())
    generated.mockClear()
    await expect(
      prepare([{ id: 'huge', role: 'user', parts: [{ type: 'text', text: 'long text '.repeat(30_000) }] }], { model })
    ).rejects.toMatchObject({ cause: expect.stringContaining('上下文预算') })
    expect(generated).not.toHaveBeenCalled()
  })
})
