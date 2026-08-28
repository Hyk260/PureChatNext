import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LocalChatTopic } from '@/features/chat/types'

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
  error: vi.fn(),
  success: vi.fn(),
  toggleWideScreen: vi.fn(),
}))

vi.mock('@pure/ui', () => ({
  ActionIcon: ({ icon: _icon, title, ...props }: { icon: unknown; title?: string }) => (
    <button aria-label={title} type='button' {...props} />
  ),
  Flex: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Icon: () => null,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Modal: ({
    children,
    okButtonProps,
    onCancel,
    onOk,
    open,
    title,
  }: {
    children?: React.ReactNode
    okButtonProps?: { disabled?: boolean }
    onCancel?: () => void
    onOk?: () => void
    open?: boolean
    title?: string
  }) =>
    open ? (
      <section aria-label={title}>
        {children}
        <button aria-label='取消重命名' onClick={onCancel} />
        <button aria-label='保存重命名' disabled={okButtonProps?.disabled} onClick={onOk} />
      </section>
    ) : null,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  confirmModal: mocks.confirm,
  copyToClipboard: mocks.copyToClipboard,
  DropdownMenu: ({ children, items }: { children?: React.ReactNode; items?: Array<Record<string, unknown>> }) => (
    <div>
      <button aria-label='更多'>{children}</button>
      <div data-testid='menu'>
        {items?.map((item, index) => {
          if (item.type === 'divider') return <hr key={`divider-${index}`} />
          const label = String(item.label)
          return (
            <button
              aria-label={label}
              data-checked={String(Boolean(item.checked))}
              disabled={Boolean(item.disabled)}
              key={String(item.key)}
              onClick={() => {
                if (item.type === 'switch') {
                  ;(item.onCheckedChange as ((checked: boolean) => void) | undefined)?.(!item.checked)
                } else {
                  ;(item.onClick as (() => void) | undefined)?.()
                }
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  ),
}))

vi.mock('antd-style', () => ({
  createStaticStyles: () => new Proxy({}, { get: (_, key) => String(key) }),
  cssVar: new Proxy({}, { get: (_, key) => String(key) }),
}))

vi.mock('@/components/AntdStaticMethods', () => ({
  useApp: () => ({
    message: { error: mocks.error, success: mocks.success },
    modal: { confirm: mocks.confirm },
  }),
}))

vi.mock('@/features/chat/store/useChatUiStore', () => ({
  useChatUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      leftCollapsed: false,
      rightCollapsed: false,
      toggleLeftCollapsed: vi.fn(),
      toggleRightCollapsed: vi.fn(),
      toggleWideScreen: mocks.toggleWideScreen,
      wideScreen: false,
    }),
}))

import ChatHeader from '../ChatHeader'

const topic: LocalChatTopic = {
  agentId: 'agent-1',
  createdAt: 1,
  favorite: false,
  id: 'topic-1',
  permissionMode: 'auto',
  projectName: null,
  title: '测试对话',
  updatedAt: 2,
}

const renderHeader = (overrides?: Partial<React.ComponentProps<typeof ChatHeader>>) => {
  const props: React.ComponentProps<typeof ChatHeader> = {
    autoRenameDisabled: false,
    autoRenaming: false,
    title: overrides?.topic?.title ?? '新话题',
    topic: null,
    onAutoRename: vi.fn(),
    onDelete: vi.fn(),
    onFavorite: vi.fn(),
    onRename: vi.fn(),
    ...overrides,
  }
  render(<ChatHeader {...props} />)
  return props
}

describe('ChatHeader menu', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows only full-width mode for a draft topic', () => {
    renderHeader()

    const menu = screen.getByTestId('menu')
    expect(menu.querySelectorAll('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: '全宽显示' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '智能重命名' })).toBeNull()
  })

  it('shows and invokes all existing-topic actions', async () => {
    const props = renderHeader({ topic, title: topic.title })

    for (const label of ['收藏', '智能重命名', '重命名', '复制会话 ID', '全宽显示', '删除']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }

    fireEvent.click(screen.getByRole('button', { name: '收藏' }))
    expect(props.onFavorite).toHaveBeenCalledWith(topic.id, true)

    fireEvent.click(screen.getByRole('button', { name: '智能重命名' }))
    expect(props.onAutoRename).toHaveBeenCalledWith(topic.id)

    fireEvent.click(screen.getByRole('button', { name: '复制会话 ID' }))
    await waitFor(() => expect(mocks.copyToClipboard).toHaveBeenCalledWith(topic.id))
    expect(mocks.success).toHaveBeenCalledWith('会话 ID 已复制')

    fireEvent.click(screen.getByRole('button', { name: '全宽显示' }))
    expect(mocks.toggleWideScreen).toHaveBeenCalledWith(true)

    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: '删除该话题？' }))
    await mocks.confirm.mock.calls[0][0].onOk()
    expect(props.onDelete).toHaveBeenCalledWith(topic.id)
  })

  it('renames from the modal and disables smart rename while busy', async () => {
    const props = renderHeader({ autoRenameDisabled: true, topic, title: topic.title })
    expect((screen.getByRole('button', { name: '智能重命名' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '重命名' }))
    const input = screen.getByPlaceholderText('话题名称')
    fireEvent.change(input, { target: { value: ' 新标题 ' } })
    fireEvent.click(screen.getByRole('button', { name: '保存重命名' }))

    await waitFor(() => expect(props.onRename).toHaveBeenCalledWith(topic.id, '新标题'))
  })

  it('shows the shared smart rename loading state', () => {
    renderHeader({ autoRenameDisabled: true, autoRenaming: true, topic, title: topic.title })

    const action = screen.getByRole('button', { name: '正在智能重命名…' }) as HTMLButtonElement
    expect(action.disabled).toBe(true)
  })
})
