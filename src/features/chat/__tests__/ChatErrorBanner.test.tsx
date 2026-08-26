import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  wideScreen: false,
}))

vi.mock('@/features/chat/store/useChatUiStore', () => ({
  useChatUiStore: (selector: (state: { wideScreen: boolean }) => unknown) => selector({ wideScreen: mocks.wideScreen }),
}))

vi.mock('@/features/chat/WideScreenContainer', () => ({
  CONVERSATION_MAX_WIDTH: 960,
}))

import ChatErrorBanner from '@/features/chat/ChatErrorBanner'

describe('ChatErrorBanner', () => {
  it('renders the message and dismisses on close', () => {
    mocks.wideScreen = false
    const onDismiss = vi.fn()
    render(<ChatErrorBanner message='发送失败' onDismiss={onDismiss} />)

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('发送失败')
    expect(alert.parentElement?.style.maxWidth).toBe('960px')

    fireEvent.click(screen.getByRole('button', { name: '关闭错误提示' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('uses the fallback message when the error has no message', () => {
    render(<ChatErrorBanner onDismiss={vi.fn()} />)

    expect(screen.getByRole('alert').textContent).toContain('发送失败，请稍后重试')
  })

  it('drops the conversation max width in wide screen', () => {
    mocks.wideScreen = true
    render(<ChatErrorBanner message='发送失败' onDismiss={vi.fn()} />)

    expect(screen.getByRole('alert').parentElement?.style.maxWidth).toBe('')
  })
})
