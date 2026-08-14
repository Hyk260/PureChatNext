import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  messageError: vi.fn(),
  push: vi.fn(),
  setPendingChatFiles: vi.fn(),
  setPendingChatText: vi.fn(),
  vision: true,
}))

vi.mock('@pure/ui', () => ({
  ActionIcon: ({ icon: _icon, ...props }: React.ComponentProps<'button'> & { icon?: unknown }) => (
    <button type='button' {...props} />
  ),
  Block: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuPopup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuPortal: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DropdownMenuPositioner: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DropdownMenuRoot: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({
    children,
    nativeButton: _nativeButton,
    ...props
  }: React.ComponentProps<'button'> & { nativeButton?: boolean }) => (
    <button type='button' {...props}>
      {children}
    </button>
  ),
  Flexbox: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Icon: () => <span />,
  renderDropdownMenuItems: (items: Array<Record<string, unknown>>) =>
    items.map((item) => (
      <button
        aria-label={String(item.key)}
        key={String(item.key)}
        type='button'
        onClick={() => (item.onClick as (() => void) | undefined)?.()}
      >
        {item.label as React.ReactNode}
      </button>
    )),
}))

vi.mock('antd-style', () => ({
  createStaticStyles: () => new Proxy({}, { get: (_, key) => String(key) }),
  cssVar: new Proxy({}, { get: (_, key) => String(key) }),
}))

vi.mock('@/components/AntdStaticMethods', () => ({ useApp: () => ({ message: { error: mocks.messageError } }) }))
vi.mock('@/assets/mascots/purechat-mecha-cat.png', () => ({ default: '/mecha-cat.png' }))
vi.mock('@/features/chat/chatLocalStorage', () => ({
  setPendingChatFiles: mocks.setPendingChatFiles,
  setPendingChatText: mocks.setPendingChatText,
}))
vi.mock('@/features/chat/ModelSwitchMenu', () => ({
  useCurrentHomeModel: () => ({ abilities: { vision: mocks.vision } }),
}))
vi.mock('@/features/chat/SendArea', () => ({
  default: ({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) => (
    <button disabled={disabled} type='button' onClick={onClick}>
      发送
    </button>
  ),
}))
vi.mock('@/features/home/components/HomeAgentSelect', () => ({
  default: () => <div>选择助理</div>,
}))
vi.mock('@/features/home/store/useAgentsStore', () => ({
  useAgentsStore: (selector: (state: unknown) => unknown) =>
    selector({ agents: [], fetchAgents: vi.fn() }),
}))
vi.mock('@/features/home/store/useHomeStore', () => ({
  useHomeStore: (selector: (state: unknown) => unknown) =>
    selector({ activeAgent: null, selectedAgentId: 'pure-ai', setActiveAgent: vi.fn() }),
}))
vi.mock('@/utils/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))

import HomeChatInput from './HomeChatInput'

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement

describe('HomeChatInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.vision = true
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })

  it('keeps send disabled with an empty draft', () => {
    render(<HomeChatInput />)
    expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('sends text and hands it off to chat', () => {
    render(<HomeChatInput />)
    fireEvent.change(screen.getByPlaceholderText('随心输入'), { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    expect(mocks.setPendingChatText).toHaveBeenCalledWith('你好')
    expect(mocks.setPendingChatFiles).toHaveBeenCalledWith([])
    expect(mocks.push).toHaveBeenCalledWith('/chat?agent=pure-ai')
  })

  it('supports attachment-only and text-with-attachment handoff', () => {
    const { unmount } = render(<HomeChatInput />)
    const documentFile = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    fireEvent.change(fileInput(), { target: { files: [documentFile] } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(mocks.setPendingChatFiles).toHaveBeenLastCalledWith([documentFile])

    unmount()
    render(<HomeChatInput />)
    const mixedFile = new File(['data'], 'data.csv', { type: 'text/csv' })
    fireEvent.change(fileInput(), { target: { files: [mixedFile] } })
    fireEvent.change(screen.getByPlaceholderText('随心输入'), { target: { value: '分析它' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(mocks.setPendingChatText).toHaveBeenLastCalledWith('分析它')
    expect(mocks.setPendingChatFiles).toHaveBeenLastCalledWith([mixedFile])
  })

  it('removes a selected attachment', () => {
    render(<HomeChatInput />)
    const file = new File(['hello'], 'remove.txt', { type: 'text/plain' })
    fireEvent.change(fileInput(), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: '删除 remove.txt' }))

    expect(screen.queryByText('remove.txt')).toBeNull()
    expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('rejects images when the selected model has no vision ability', () => {
    mocks.vision = false
    render(<HomeChatInput />)
    const image = new File(['image'], 'cat.png', { type: 'image/png' })
    fireEvent.change(fileInput(), { target: { files: [image] } })

    expect(mocks.messageError).toHaveBeenCalledWith('当前模型不支持图片理解')
    expect(screen.queryByText('cat.png')).toBeNull()
  })

  it('opens the file picker from the plus menu', () => {
    render(<HomeChatInput />)
    const click = vi.spyOn(fileInput(), 'click')
    fireEvent.click(screen.getByRole('button', { name: 'attachments' }))
    expect(click).toHaveBeenCalled()
  })
})
