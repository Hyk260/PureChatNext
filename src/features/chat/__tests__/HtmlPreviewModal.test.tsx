import { fireEvent, render } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@pure/ui', () => ({
  ActionIcon: ({ title, onClick }: { onClick?: () => void; title?: string }) => (
    <button type='button' onClick={onClick}>
      {title}
    </button>
  ),
  copyToClipboard: vi.fn(),
  HtmlPreview: ({
    actionsRender,
    children,
  }: {
    actionsRender?: (props: {
      actionIconSize: 'small'
      content: string
      getContent: () => string
      mode: 'preview' | 'source'
      originalNode: React.ReactNode
      setMode: (mode: 'preview' | 'source') => void
    }) => React.ReactNode
    children: string
  }) => (
    <>
      {actionsRender?.({
        actionIconSize: 'small',
        content: children,
        getContent: () => children,
        mode: 'preview',
        originalNode: null,
        setMode: vi.fn(),
      })}
      <iframe sandbox='allow-scripts allow-forms allow-modals' srcDoc={children} title='HTML 预览' />
    </>
  ),
  Modal: ({
    children,
    onCancel,
    open,
    title,
  }: {
    children: React.ReactNode
    onCancel: () => void
    open: boolean
    title: React.ReactNode
  }) =>
    open ? (
      <div role='dialog' aria-label={String(title)}>
        <button type='button' onClick={onCancel}>
          关闭
        </button>
        {children}
      </div>
    ) : null,
}))

import HtmlPreviewModal from '../HtmlPreviewModal'

describe('HtmlPreviewModal', () => {
  it('renders a sandboxed preview iframe', () => {
    const { getByTitle } = render(
      <HtmlPreviewModal content='<h1>登录</h1>' open onClose={vi.fn()} />
    )

    const iframe = getByTitle('HTML 预览') as HTMLIFrameElement
    const sandbox = iframe.getAttribute('sandbox') ?? ''
    expect(sandbox).toContain('allow-scripts')
    expect(sandbox).not.toContain('allow-same-origin')
    expect(iframe.srcdoc).toContain('<h1>登录</h1>')
  })

  it('renders Chinese toolbar labels', () => {
    const { getByRole, getByText } = render(
      <HtmlPreviewModal content='<h1>登录</h1>' open onClose={vi.fn()} />
    )

    expect(getByText('预览')).toBeTruthy()
    expect(getByText('源码')).toBeTruthy()
    expect(getByRole('button', { name: '复制' })).toBeTruthy()
    expect(getByRole('button', { name: '下载 HTML' })).toBeTruthy()
  })

  it('closes from the dialog cancel action', () => {
    const onClose = vi.fn()
    const { getByRole } = render(<HtmlPreviewModal content='<p>hi</p>' open onClose={onClose} />)

    fireEvent.click(getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
