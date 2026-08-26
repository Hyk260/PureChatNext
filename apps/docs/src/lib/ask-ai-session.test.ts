import { afterEach, describe, expect, it } from 'vitest'
import {
  ASK_AI_MESSAGES_KEY,
  getAskAIBusyLabel,
  hasPendingSearchDocs,
  hasVisibleAskAIText,
  loadAskAIMessages,
  rewriteDocsMarkdownHrefs,
  saveAskAIMessages,
  toDocsRelativeHref,
} from '@/lib/ask-ai-session'
import { SITE_URL } from '@/lib/site'

const memory = new Map<string, string>()

function installLocalStorage() {
  memory.clear()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => memory.get(key) ?? null,
        removeItem: (key: string) => {
          memory.delete(key)
        },
        setItem: (key: string, value: string) => {
          memory.set(key, value)
        },
      },
    },
  })
}

describe('Ask AI reply rendering states', () => {
  it('keeps a status label until assistant text is visible', () => {
    expect(
      getAskAIBusyLabel({ hasPendingSearch: false, hasVisibleText: false, status: 'submitted' }),
    ).toBe('正在思考…')
    expect(
      getAskAIBusyLabel({ hasPendingSearch: true, hasVisibleText: false, status: 'streaming' }),
    ).toBe('正在检索文档…')
    expect(
      getAskAIBusyLabel({ hasPendingSearch: false, hasVisibleText: false, status: 'streaming' }),
    ).toBe('正在生成回答…')
    expect(
      getAskAIBusyLabel({ hasPendingSearch: false, hasVisibleText: true, status: 'streaming' }),
    ).toBeNull()
  })

  it('treats empty assistant text as hidden content', () => {
    expect(
      hasVisibleAskAIText({
        id: 'assistant-1',
        parts: [
          { text: '   ', type: 'text' },
          { type: 'step-start' },
        ],
        role: 'assistant',
      }),
    ).toBe(false)
    expect(
      hasVisibleAskAIText({
        id: 'assistant-2',
        parts: [{ text: '可以先看快速开始。', type: 'text' }],
        role: 'assistant',
      }),
    ).toBe(true)
    expect(
      hasPendingSearchDocs({
        id: 'assistant-3',
        parts: [{ input: { query: '快速开始' }, state: 'input-available', toolCallId: 'tool-1', type: 'tool-searchDocs' }],
        role: 'assistant',
      }),
    ).toBe(true)
  })
})

describe('Ask AI docs href rewriting', () => {
  it('turns production and local docs URLs into site-relative paths', () => {
    expect(toDocsRelativeHref(`${SITE_URL}/self-hosting/features/online-search`)).toBe(
      '/self-hosting/features/online-search',
    )
    expect(toDocsRelativeHref('http://localhost:3020/self-hosting/features/online-search#前置条件')).toBe(
      '/self-hosting/features/online-search#前置条件',
    )
    expect(toDocsRelativeHref('/getting-started/quick-start')).toBe('/getting-started/quick-start')
  })

  it('leaves external links unchanged', () => {
    expect(toDocsRelativeHref('https://github.com/Hyk260/PureChatNext')).toBe(
      'https://github.com/Hyk260/PureChatNext',
    )
    expect(toDocsRelativeHref('https://next.purechat.cn')).toBe('https://next.purechat.cn')
  })

  it('rewrites markdown documentation links without touching other URLs', () => {
    const markdown =
      '见 [配置联网搜索功能](https://next-docs.purechat.cn/self-hosting/features/online-search) 和 [仓库](https://github.com/Hyk260/PureChatNext)。'

    expect(rewriteDocsMarkdownHrefs(markdown)).toBe(
      '见 [配置联网搜索功能](/self-hosting/features/online-search) 和 [仓库](https://github.com/Hyk260/PureChatNext)。',
    )
  })
})

describe('Ask AI local session storage', () => {
  afterEach(() => {
    memory.clear()
    Reflect.deleteProperty(globalThis, 'window')
  })

  it('rewrites production docs URLs when persisting assistant messages', async () => {
    installLocalStorage()
    saveAskAIMessages([
      {
        id: 'assistant-1',
        parts: [
          {
            text: '见 [配置联网搜索功能](https://next-docs.purechat.cn/self-hosting/features/online-search)。',
            type: 'text',
          },
        ],
        role: 'assistant',
      },
    ])

    await expect(loadAskAIMessages()).resolves.toMatchObject([
      {
        parts: [{ text: '见 [配置联网搜索功能](/self-hosting/features/online-search)。', type: 'text' }],
        role: 'assistant',
      },
    ])
  })

  it('round-trips valid messages and clears empty conversations', async () => {
    installLocalStorage()
    const messages = [{ id: 'message-1', parts: [{ text: '如何开始？', type: 'text' as const }], role: 'user' as const }]

    saveAskAIMessages(messages)
    expect(memory.get(ASK_AI_MESSAGES_KEY)).toContain('如何开始？')
    await expect(loadAskAIMessages()).resolves.toMatchObject(messages)

    saveAskAIMessages([])
    expect(memory.has(ASK_AI_MESSAGES_KEY)).toBe(false)
    await expect(loadAskAIMessages()).resolves.toEqual([])
  })

  it('does not persist empty assistant placeholders', async () => {
    installLocalStorage()
    saveAskAIMessages([
      { id: 'message-1', parts: [{ text: '如何开始？', type: 'text' }], role: 'user' },
      { id: 'assistant-1', parts: [{ text: '', type: 'text' }], role: 'assistant' },
    ])

    await expect(loadAskAIMessages()).resolves.toMatchObject([
      { parts: [{ text: '如何开始？', type: 'text' }], role: 'user' },
    ])
  })

  it('ignores invalid stored payloads', async () => {
    installLocalStorage()
    memory.set(ASK_AI_MESSAGES_KEY, '{"broken":true}')
    await expect(loadAskAIMessages()).resolves.toEqual([])
  })
})
