import { afterEach, describe, expect, it } from 'vitest'
import {
  ASK_AI_MESSAGES_KEY,
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

  it('ignores invalid stored payloads', async () => {
    installLocalStorage()
    memory.set(ASK_AI_MESSAGES_KEY, '{"broken":true}')
    await expect(loadAskAIMessages()).resolves.toEqual([])
  })
})
