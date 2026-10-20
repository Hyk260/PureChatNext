import { fireEvent, render, waitFor } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@pure/ui', () => ({
  Flex: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Text: ({ children, role }: React.PropsWithChildren<{ role?: string }>) => <span role={role}>{children}</span>,
  Modal: ({
    cancelText,
    children,
    confirmLoading,
    okText,
    okButtonProps,
    onCancel,
    onOk,
    open,
  }: {
    cancelText: React.ReactNode
    children: React.ReactNode
    confirmLoading?: boolean
    okText: React.ReactNode
    okButtonProps?: { disabled?: boolean }
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
        <button aria-busy={confirmLoading} disabled={okButtonProps?.disabled} type='button' onClick={onOk}>
          {okText}
        </button>
      </div>
    ) : null,
}))

vi.mock('@lobehub/editor', () => ({
  ReactCodePlugin: () => null,
  ReactCodemirrorPlugin: () => null,
  ReactHRPlugin: () => null,
  ReactImagePlugin: () => null,
  ReactLinkPlugin: () => null,
  ReactListPlugin: () => null,
  ReactMathPlugin: () => null,
  ReactTablePlugin: () => null,
}))

interface TestEditor {
  markdown: string
  getDocument: () => string
  getRootElement: () => null
}

vi.mock('@lobehub/editor/react', () => ({
  useEditor: () =>
    React.useMemo(
      () => ({
        markdown: '',
        getDocument() {
          return this.markdown
        },
        getRootElement: () => null,
      }),
      []
    ),
  Editor: ({
    content,
    editor,
    onInit,
  }: {
    content: string
    editor: TestEditor
    onInit: (editor: TestEditor) => void
  }) => {
    const [draft, setDraft] = React.useState(content)
    const initialized = React.useRef(false)
    React.useEffect(() => {
      if (initialized.current) return
      initialized.current = true
      editor.markdown = content
      onInit(editor)
    }, [content, editor, onInit])

    return (
      <textarea
        aria-label='消息内容'
        value={draft}
        onChange={(event) => {
          editor.markdown = event.target.value
          setDraft(event.target.value)
        }}
      />
    )
  },
}))

vi.mock('@/components/ContentEditorModal/Toolbar', () => ({ default: () => null }))

import MessageEditorModal from '@/components/ContentEditorModal/EditorModal'

describe('MessageEditorModal', () => {
  it('uses 保存 as the submit label', () => {
    const { getByRole } = render(<MessageEditorModal open value='hello' onCancel={vi.fn()} onSubmit={vi.fn()} />)

    expect(getByRole('button', { name: '保存' })).toBeTruthy()
    expect((getByRole('textbox', { name: '消息内容' }) as HTMLTextAreaElement).value).toBe('hello')
  })

  it.each([
    ['取消按钮', (view: ReturnType<typeof render>) => view.getByRole('button', { name: '取消' })],
    ['蒙版', (view: ReturnType<typeof render>) => view.getByRole('button', { name: '蒙版' })],
  ])('%s closes without submitting', (_source, getTarget) => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn()
    const view = render(<MessageEditorModal open value='hello' onCancel={onCancel} onSubmit={onSubmit} />)

    fireEvent.click(getTarget(view))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('Escape closes without submitting', () => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn()
    const view = render(<MessageEditorModal open value='hello' onCancel={onCancel} onSubmit={onSubmit} />)

    fireEvent.keyDown(view.getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits trimmed content and closes after success', async () => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const view = render(<MessageEditorModal open value='hello' onCancel={onCancel} onSubmit={onSubmit} />)

    fireEvent.change(view.getByRole('textbox', { name: '消息内容' }), {
      target: { value: '  updated  ' },
    })
    fireEvent.click(view.getByRole('button', { name: '保存' }))

    expect(onSubmit).toHaveBeenCalledWith('updated')
    await waitFor(() => expect(onCancel).toHaveBeenCalledOnce())
  })

  it.each(['', '  ', 'hello'])('closes without submitting unchanged or blank content: %j', async (draft) => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn()
    const view = render(<MessageEditorModal open value='hello' onCancel={onCancel} onSubmit={onSubmit} />)

    fireEvent.change(view.getByRole('textbox', { name: '消息内容' }), { target: { value: draft } })
    fireEvent.click(view.getByRole('button', { name: '保存' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('keeps the modal open and clears loading when submission fails', async () => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn().mockRejectedValue(new Error('save failed'))
    const view = render(<MessageEditorModal open value='hello' onCancel={onCancel} onSubmit={onSubmit} />)

    fireEvent.change(view.getByRole('textbox', { name: '消息内容' }), { target: { value: 'updated' } })
    fireEvent.click(view.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(view.getByRole('button', { name: '保存' }).getAttribute('aria-busy')).toBe('false'))
    expect(onCancel).not.toHaveBeenCalled()
    expect(view.getByRole('dialog')).toBeTruthy()
    expect(view.getByRole('alert').textContent).toBe('保存失败，请重试')
  })
})
