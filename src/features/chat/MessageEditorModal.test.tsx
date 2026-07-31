import { fireEvent, render, waitFor } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('antd', () => ({
  Input: {
    TextArea: ({ onChange, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
      <textarea {...props} onChange={onChange} />
    ),
  },
}))

vi.mock('@pure/ui', () => ({
  Modal: ({
    cancelText,
    children,
    confirmLoading,
    okText,
    onCancel,
    onOk,
    open,
  }: {
    cancelText: React.ReactNode
    children: React.ReactNode
    confirmLoading?: boolean
    okText: React.ReactNode
    onCancel: () => void
    onOk: () => void
    open: boolean
  }) =>
    open ? (
      <div
        aria-label='编辑消息'
        role='dialog'
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel()
        }}
      >
        <button aria-label='蒙版' type='button' onClick={onCancel} />
        {children}
        <button type='button' onClick={onCancel}>
          {cancelText}
        </button>
        <button aria-busy={confirmLoading} type='button' onClick={onOk}>
          {okText}
        </button>
      </div>
    ) : null,
}))

import MessageEditorModal from '@/features/chat/MessageEditorModal'

describe('MessageEditorModal', () => {
  it.each([
    [true, '发送'],
    [false, '保存'],
  ])('uses the expected submit label when isUser is %s', (isUser, label) => {
    const { getByRole } = render(
      <MessageEditorModal isUser={isUser} open value='hello' onCancel={vi.fn()} onSubmit={vi.fn()} />
    )

    expect(getByRole('button', { name: label })).toBeTruthy()
    expect((getByRole('textbox', { name: '消息内容' }) as HTMLTextAreaElement).value).toBe('hello')
  })

  it.each([
    ['取消按钮', (view: ReturnType<typeof render>) => view.getByRole('button', { name: '取消' })],
    ['蒙版', (view: ReturnType<typeof render>) => view.getByRole('button', { name: '蒙版' })],
  ])('%s closes without submitting', (_source, getTarget) => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn()
    const view = render(
      <MessageEditorModal isUser={false} open value='hello' onCancel={onCancel} onSubmit={onSubmit} />
    )

    fireEvent.click(getTarget(view))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('Escape closes without submitting', () => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn()
    const view = render(
      <MessageEditorModal isUser={false} open value='hello' onCancel={onCancel} onSubmit={onSubmit} />
    )

    fireEvent.keyDown(view.getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits trimmed content and closes after success', async () => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const view = render(<MessageEditorModal isUser open value='hello' onCancel={onCancel} onSubmit={onSubmit} />)

    fireEvent.change(view.getByRole('textbox', { name: '消息内容' }), {
      target: { value: '  updated  ' },
    })
    fireEvent.click(view.getByRole('button', { name: '发送' }))

    expect(onSubmit).toHaveBeenCalledWith('updated')
    await waitFor(() => expect(onCancel).toHaveBeenCalledOnce())
  })

  it.each(['', '  ', 'hello'])('closes without submitting unchanged or blank content: %j', async (draft) => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn()
    const view = render(
      <MessageEditorModal isUser={false} open value='hello' onCancel={onCancel} onSubmit={onSubmit} />
    )

    fireEvent.change(view.getByRole('textbox', { name: '消息内容' }), { target: { value: draft } })
    fireEvent.click(view.getByRole('button', { name: '保存' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('keeps the modal open and clears loading when submission fails', async () => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn().mockRejectedValue(new Error('save failed'))
    const view = render(
      <MessageEditorModal isUser={false} open value='hello' onCancel={onCancel} onSubmit={onSubmit} />
    )

    fireEvent.change(view.getByRole('textbox', { name: '消息内容' }), { target: { value: 'updated' } })
    fireEvent.click(view.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(view.getByRole('button', { name: '保存' }).getAttribute('aria-busy')).toBe('false'))
    expect(onCancel).not.toHaveBeenCalled()
    expect(view.getByRole('dialog')).toBeTruthy()
  })
})
