import { render, screen } from '@testing-library/react'
import type { UIMessage } from 'ai'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@pure/ui', () => ({
  Avatar: ({ avatar }: { avatar: string }) => <span data-avatar={avatar} />,
}))

vi.mock('antd-style', () => ({
  createStaticStyles: () => new Proxy({}, { get: (_, key) => String(key) }),
  cssVar: new Proxy({}, { get: (_, key) => String(key) }),
}))

import WebSearchStatus, { getWebSearchStatusSignature, hasWebSearchToolPart } from '../WebSearchStatus'

const createMessage = (part: Record<string, unknown>): UIMessage =>
  ({
    id: 'assistant-search',
    parts: [{ toolCallId: 'search-1', type: 'tool-webSearch', ...part }],
    role: 'assistant',
  }) as unknown as UIMessage

describe('WebSearchStatus', () => {
  it('renders an in-progress tool call', () => {
    const message = createMessage({ input: { query: 'latest news' }, state: 'input-available' })

    render(<WebSearchStatus message={message} />)

    expect(screen.getByText('正在联网搜索…')).toBeTruthy()
    expect(hasWebSearchToolPart(message)).toBe(true)
    expect(getWebSearchStatusSignature(message)).toBe('input-available')
  })

  it('renders persisted successful sources as safe links', () => {
    const message = createMessage({
      input: { query: 'latest news' },
      output: {
        query: 'latest news',
        results: [
          { content: 'one', title: 'Source one', url: 'https://example.com/one' },
          { content: 'two', title: 'Unsafe source', url: 'javascript:alert(1)' },
        ],
        success: true,
      },
      state: 'output-available',
    })

    render(<WebSearchStatus message={message} />)

    expect(screen.getByText('已搜索 2 个来源')).toBeTruthy()
    const link = screen.getByRole('link', { name: /Source one/ })
    expect(link.getAttribute('href')).toBe('https://example.com/one')
    expect(screen.queryByRole('link', { name: /Unsafe source/ })).toBeNull()
    expect(getWebSearchStatusSignature(message)).toBe('true:2')
  })

  it('renders empty and failed outcomes', () => {
    const empty = createMessage({
      input: { query: 'nothing' },
      output: { query: 'nothing', results: [], success: true },
      state: 'output-available',
    })
    const { rerender } = render(<WebSearchStatus message={empty} />)
    expect(screen.getByText('未找到相关网页来源')).toBeTruthy()

    rerender(
      <WebSearchStatus
        message={createMessage({
          input: { query: 'failure' },
          output: {
            error: '联网搜索暂不可用，请检查搜索服务配置后重试。',
            query: 'failure',
            results: [],
            success: false,
          },
          state: 'output-available',
        })}
      />
    )
    expect(screen.getByText('联网搜索暂不可用，请检查搜索服务配置后重试。')).toBeTruthy()
  })

  it('does not expose raw AI SDK tool errors', () => {
    const message = createMessage({ errorText: 'API key secret', input: { query: 'failure' }, state: 'output-error' })

    render(<WebSearchStatus message={message} />)

    expect(screen.getByText('联网搜索失败，请稍后重试')).toBeTruthy()
    expect(screen.queryByText(/secret/)).toBeNull()
  })
})
