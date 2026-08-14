import { fireEvent, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type ActionsRender = (props: {
  actionIconSize: string
  content: string
  getContent: () => string
  language: string
  originalNode: ReactNode
}) => ReactNode

const markdownSpy = vi.fn()

vi.mock('@pure/ui/Markdown', () => ({
  Markdown: ({ children, ...props }: { children?: ReactNode }) => {
    markdownSpy(props)
    return <article data-testid='markdown'>{children}</article>
  },
}))

vi.mock('@pure/ui', () => ({
  ActionIcon: ({ title, onClick }: { title?: string; onClick?: () => void }) => (
    <button type='button' onClick={onClick}>
      {title}
    </button>
  ),
}))

vi.mock('@/features/chat/HtmlPreviewModal', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid='html-preview-modal' /> : null),
}))

import MessageMarkdown from './MessageMarkdown'

beforeEach(() => {
  markdownSpy.mockClear()
})

function getActionsRender() {
  const props = markdownSpy.mock.lastCall?.[0] as { componentProps?: { highlight?: { actionsRender?: ActionsRender } } }
  return props.componentProps?.highlight?.actionsRender
}

function renderActions(language: string, isStreaming = false) {
  const markdownView = render(<MessageMarkdown isStreaming={isStreaming} text='```html\n<button>登录</button>\n```' />)
  const actionsRender = getActionsRender()
  expect(actionsRender).toBeTypeOf('function')

  const actionsView = render(
    <div>
      {actionsRender!({
        actionIconSize: 'small',
        content: '<button>登录</button>',
        getContent: () => '<button>登录</button>',
        language,
        originalNode: <span data-testid='copy' />,
      })}
    </div>,
    { container: document.body.appendChild(document.createElement('div')) }
  )

  return { actionsView, markdownView }
}

describe('MessageMarkdown', () => {
  it('keeps Markdown rendering enabled while content is streaming', () => {
    const { getByTestId, rerender } = render(<MessageMarkdown isStreaming text='**粗体' />)

    expect(getByTestId('markdown').textContent).toBe('**粗体')
    expect(markdownSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ animated: true, enableStream: true, variant: 'chat' })
    )

    rerender(<MessageMarkdown isStreaming text='**粗体**' />)
    expect(getByTestId('markdown').textContent).toBe('**粗体**')
    expect(markdownSpy).toHaveBeenCalledTimes(2)
  })

  it('turns off animation without switching renderers after streaming', () => {
    const { getByTestId } = render(<MessageMarkdown text='| A | B |' />)

    expect(getByTestId('markdown').textContent).toBe('| A | B |')
    expect(markdownSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ animated: false, enableStream: true, variant: 'chat' })
    )
  })

  it('hides the HTML preview action while streaming', () => {
    const { actionsView } = renderActions('html', true)
    expect(actionsView.queryByRole('button', { name: '预览' })).toBeNull()
    expect(actionsView.getByTestId('copy')).toBeTruthy()
  })

  it('shows the HTML preview action after streaming and opens the modal', () => {
    const { actionsView, markdownView } = renderActions('html')
    expect(markdownView.queryByTestId('html-preview-modal')).toBeNull()

    fireEvent.click(actionsView.getByRole('button', { name: '预览' }))
    expect(markdownView.getByTestId('html-preview-modal')).toBeTruthy()
  })

  it('does not show the preview action for other languages', () => {
    const { actionsView } = renderActions('ts')
    expect(actionsView.queryByRole('button', { name: '预览' })).toBeNull()
    expect(actionsView.getByTestId('copy')).toBeTruthy()
  })
})
