import { fireEvent, render } from '@testing-library/react'
import type { UIMessage } from 'ai'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@pure/ui', () => ({
  Accordion: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) => (
    <div>
      {title}
      {children}
    </div>
  ),
  ActionIcon: ({ icon: _icon, title, ...props }: { icon: unknown; title: string }) => (
    <button aria-label={title} type='button' {...props} />
  ),
  Avatar: () => <span />,
  Block: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenu: ({
    children,
    items,
  }: {
    children?: React.ReactNode
    items?: Array<{ key?: string; label?: string; onClick?: () => void; type?: string }>
  }) => (
    <>
      {children}
      {items?.map((item) =>
        item.type === 'divider' ? null : (
          <button key={item.key} aria-label={`菜单-${item.label}`} type='button' onClick={item.onClick} />
        )
      )}
    </>
  ),
  Flexbox: ({
    children,
    align: _align,
    gap: _gap,
    horizontal: _horizontal,
    justify: _justify,
    ...props
  }: {
    children?: React.ReactNode
    align?: string
    gap?: number
    horizontal?: boolean
    justify?: string
  } & React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  Icon: () => <span />,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  copyToClipboard: vi.fn(),
}))

vi.mock('@/components/AntdStaticMethods', () => ({
  useApp: () => ({ message: { success: vi.fn() } }),
}))

vi.mock('@/components/Loading', () => ({
  PulseDots: () => <span data-testid='pulse-dots' />,
}))

vi.mock('@/components/Scrollbar', () => ({
  default: React.forwardRef<HTMLDivElement, { children?: React.ReactNode }>(function MockScrollbar({ children }, _ref) {
    return <div data-testid='custom-scrollbar'>{children}</div>
  }),
}))

vi.mock('@/features/chat/MessageMarkdown', () => ({
  default: ({ text }: { text: string }) => <div>{text}</div>,
}))

vi.mock('@/features/chat/MessageUsage', () => ({
  default: () => <div data-testid='message-usage' />,
}))

vi.mock('@/features/chat/MessageEditorModal', () => ({
  default: ({
    onSubmit,
    open,
    value,
  }: {
    onSubmit: (value: string) => void
    open: boolean
    value: string
  }) =>
    open ? (
      <div data-testid='message-editor' data-value={value}>
        <button type='button' onClick={() => onSubmit('edited message')}>
          提交编辑
        </button>
      </div>
    ) : null,
}))

vi.mock('@/features/chat/store/useChatUiStore', () => ({
  useChatUiStore: (selector: (state: { wideScreen: boolean }) => unknown) => selector({ wideScreen: false }),
}))

vi.mock('@/features/chat/useAutoScroll', () => ({
  useAutoScroll: () => ({ handleScroll: vi.fn(), resetScrollLock: vi.fn() }),
}))

import ChatMessages from '@/features/chat/ChatMessages'

const messages: UIMessage[] = [
  { id: 'user-1', parts: [{ text: 'hello', type: 'text' }], role: 'user' },
  {
    id: 'assistant-1',
    metadata: { model: 'deepseek-reasoner', provider: 'deepseek' },
    parts: [{ text: 'hi', type: 'text' }],
    role: 'assistant',
  },
]

describe('ChatMessages message layout', () => {
  it('renders both action bars as siblings of message content', () => {
    const { container, getByTestId } = render(
      <ChatMessages
        agentMeta={{ avatar: '✨', title: 'Pure AI' }}
        messages={messages}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
      />
    )

    expect(getByTestId('custom-scrollbar')).toBeTruthy()
    expect(getByTestId('message-usage')).toBeTruthy()

    for (const role of ['user', 'assistant']) {
      const row = container.querySelector(`[data-role="${role}"]`)
      const content = row?.querySelector('[data-message-content]')
      const actions = row?.querySelector('[data-message-actions]')

      expect(content).toBeTruthy()
      expect(actions).toBeTruthy()
      expect(content?.contains(actions ?? null)).toBe(false)
      expect(actions?.parentElement).toBe(row)
    }
  })

  it.each([
    ['操作栏', '编辑'],
    ['更多菜单', '菜单-编辑'],
  ])('opens the editor from the %s edit action', (_source, label) => {
    const onEdit = vi.fn()
    const { container, getByLabelText, getByTestId, getByText } = render(
      <ChatMessages messages={[messages[0]]} onDelete={vi.fn()} onEdit={onEdit} onRegenerate={vi.fn()} />
    )

    const row = container.querySelector('[data-role="user"]')!
    fireEvent.click(getByLabelText(label, { selector: `[data-role="user"] button` }))

    const editor = getByTestId('message-editor')
    expect(editor.dataset.value).toBe('hello')

    fireEvent.click(getByText('提交编辑'))
    expect(onEdit).toHaveBeenCalledWith('user-1', 'edited message')
    expect(row).toBeTruthy()
  })

  it('stops the thinking state at reasoning-end while the answer keeps streaming', () => {
    const streamingMessage: UIMessage = {
      id: 'assistant-reasoning',
      metadata: { model: 'deepseek-reasoner', provider: 'deepseek' },
      parts: [{ state: 'streaming', text: 'reasoning', type: 'reasoning' }],
      role: 'assistant',
    }
    const props = {
      isStreaming: true,
      onDelete: vi.fn(),
      onEdit: vi.fn(),
      onRegenerate: vi.fn(),
    }
    const { getByText, queryByText, rerender } = render(<ChatMessages messages={[streamingMessage]} {...props} />)

    expect(getByText('深度思考中…')).toBeTruthy()

    rerender(
      <ChatMessages
        messages={[
          {
            ...streamingMessage,
            metadata: {
              model: 'deepseek-reasoner',
              provider: 'deepseek',
              reasoning: { duration: 1450 },
            },
            parts: [
              { state: 'done', text: 'reasoning', type: 'reasoning' },
              { state: 'streaming', text: '答', type: 'text' },
            ],
          },
        ]}
        {...props}
      />
    )

    expect(queryByText('深度思考中…')).toBeNull()
    expect(getByText('已深度思考（用时 1.4 秒）')).toBeTruthy()
  })

  it('renders persisted reasoning duration after remounting a conversation', () => {
    const message: UIMessage = {
      id: 'assistant-persisted-reasoning',
      metadata: {
        model: 'deepseek-reasoner',
        provider: 'deepseek',
        reasoning: { duration: 2300 },
      },
      parts: [{ state: 'done', text: 'reasoning', type: 'reasoning' }],
      role: 'assistant',
    }

    const { getByText } = render(
      <ChatMessages messages={[message]} onDelete={vi.fn()} onEdit={vi.fn()} onRegenerate={vi.fn()} />
    )

    expect(getByText('已深度思考（用时 2.3 秒）')).toBeTruthy()
  })

  it('keeps action placeholders while streaming and reveals them when finished', () => {
    const streamingMessage: UIMessage = {
      id: 'assistant-stream',
      parts: [{ state: 'streaming', text: '答', type: 'text' }],
      role: 'assistant',
    }
    const { container, rerender } = render(
      <ChatMessages isStreaming messages={[streamingMessage]} onDelete={vi.fn()} onEdit={vi.fn()} onRegenerate={vi.fn()} />
    )

    const streamingActions = container.querySelector('[data-message-actions]')
    expect(streamingActions).toBeTruthy()
    expect(streamingActions?.getAttribute('aria-hidden')).toBe('true')

    rerender(
      <ChatMessages messages={[streamingMessage]} onDelete={vi.fn()} onEdit={vi.fn()} onRegenerate={vi.fn()} />
    )

    const finishedActions = container.querySelector('[data-message-actions]')
    expect(finishedActions?.getAttribute('aria-hidden')).toBeNull()
  })

  it('uses PulseDots while waiting for the first response content', () => {
    const message: UIMessage = { id: 'assistant-loading', parts: [], role: 'assistant' }
    const { getByTestId } = render(
      <ChatMessages isStreaming messages={[message]} onDelete={vi.fn()} onEdit={vi.fn()} onRegenerate={vi.fn()} />
    )

    expect(getByTestId('pulse-dots')).toBeTruthy()
  })

  it('hides PulseDots once reasoning content starts', () => {
    const message: UIMessage = {
      id: 'assistant-reasoning-loading',
      parts: [{ state: 'streaming', text: 'thinking…', type: 'reasoning' }],
      role: 'assistant',
    }
    const { queryByTestId } = render(
      <ChatMessages isStreaming messages={[message]} onDelete={vi.fn()} onEdit={vi.fn()} onRegenerate={vi.fn()} />
    )

    expect(queryByTestId('pulse-dots')).toBeNull()
  })

  it('renders a search-only assistant message without the generic loading dots', () => {
    const message = {
      id: 'assistant-searching',
      parts: [
        {
          input: { query: 'latest news' },
          state: 'input-available',
          toolCallId: 'search-1',
          type: 'tool-webSearch',
        },
      ],
      role: 'assistant',
    } as UIMessage

    const { getByText, queryByTestId } = render(
      <ChatMessages isStreaming messages={[message]} onDelete={vi.fn()} onEdit={vi.fn()} onRegenerate={vi.fn()} />
    )

    expect(getByText('正在联网搜索…')).toBeTruthy()
    expect(queryByTestId('pulse-dots')).toBeNull()
  })
})
