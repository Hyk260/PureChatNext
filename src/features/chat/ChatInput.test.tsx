import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@pure/ui', () => ({
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
        data-checked={String(Boolean(item.checked))}
        disabled={Boolean(item.disabled)}
        key={String(item.key)}
        type='button'
        onClick={() => {
          if (item.type === 'switch') {
            ;(item.onCheckedChange as ((checked: boolean) => void) | undefined)?.(!item.checked)
          } else {
            ;(item.onClick as (() => void) | undefined)?.()
          }
        }}
      />
    )),
}))

vi.mock('antd-style', () => ({
  createStaticStyles: () => new Proxy({}, { get: (_, key) => String(key) }),
  cssVar: new Proxy({}, { get: (_, key) => String(key) }),
  cx: (...values: Array<string | false | undefined>) => values.filter(Boolean).join(' '),
}))

vi.mock('@/features/chat/ModelSelector', () => ({ default: () => <span>model</span> }))
vi.mock('@/features/chat/SendArea', () => ({
  SendButton: ({ onClick }: { onClick: () => void }) => (
    <button type='button' onClick={onClick}>
      send
    </button>
  ),
}))
vi.mock('@/features/chat/store/useChatUiStore', () => ({
  useChatUiStore: (selector: (state: unknown) => unknown) =>
    selector({ rightCollapsed: true, toggleRightCollapsed: vi.fn() }),
}))

import ChatInput from './ChatInput'

describe('ChatInput web search mode', () => {
  it('toggles search from off to auto', () => {
    const onSearchModeChange = vi.fn()
    render(<ChatInput searchMode='off' onSearchModeChange={onSearchModeChange} onSend={vi.fn()} />)

    const search = screen.getByRole('button', { name: 'search' })

    fireEvent.click(search)
    expect(onSearchModeChange).toHaveBeenCalledWith('auto')
  })

  it('toggles search from auto to off', () => {
    const onSearchModeChange = vi.fn()
    render(<ChatInput searchMode='auto' onSearchModeChange={onSearchModeChange} onSend={vi.fn()} />)

    const search = screen.getByRole('button', { name: 'search' })

    fireEvent.click(search)
    expect(onSearchModeChange).toHaveBeenCalledWith('off')
  })

  it('disables search changes while generation is busy', () => {
    render(<ChatInput isBusy searchMode='off' onSearchModeChange={vi.fn()} onSend={vi.fn()} />)

    expect((screen.getByRole('button', { name: 'search' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('does not send composing IME text on Enter', () => {
    const onSend = vi.fn()
    render(<ChatInput searchMode='off' onSearchModeChange={vi.fn()} onSend={onSend} />)

    const textarea = screen.getByPlaceholderText('随心输入')
    fireEvent.change(textarea, { target: { value: 'asd' } })
    fireEvent.compositionStart(textarea)
    fireEvent.keyDown(textarea, { isComposing: true, key: 'Enter', keyCode: 229 })

    expect(onSend).not.toHaveBeenCalled()
    expect((textarea as HTMLTextAreaElement).value).toBe('asd')
  })

  it('sends on Enter when IME is idle', () => {
    const onSend = vi.fn()
    render(<ChatInput searchMode='off' onSearchModeChange={vi.fn()} onSend={onSend} />)

    const textarea = screen.getByPlaceholderText('随心输入')
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(onSend).toHaveBeenCalledWith('hello', [])
  })
})
