'use client'

import { Input, Modal } from '@pure/ui'
import { memo, useEffect, useState } from 'react'

interface MessageEditorModalProps {
  onCancel: () => void
  onSubmit: (value: string) => void | Promise<void>
  open: boolean
  value: string
}

const MessageEditorModal = memo<MessageEditorModalProps>(({ onCancel, onSubmit, open, value }) => {
  const [draft, setDraft] = useState(value)
  const [confirmLoading, setConfirmLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft(value)
  }, [open, value])

  const handleSubmit = async () => {
    const next = draft.trim()
    if (!next || next === value) {
      onCancel()
      return
    }

    setConfirmLoading(true)
    try {
      await onSubmit(next)
      onCancel()
    } catch {
      return
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <Modal
      cancelText='取消'
      closable={false}
      confirmLoading={confirmLoading}
      destroyOnHidden
      okText='保存'
      open={open}
      title={null}
      width='min(90vw, 920px)'
      styles={{ body: { padding: 0 } }}
      onCancel={onCancel}
      onOk={handleSubmit}
    >
      <Input.TextArea
        aria-label='消息内容'
        autoFocus
        value={draft}
        style={{ minHeight: 320, padding: 16, resize: 'vertical' }}
        onChange={(event) => setDraft(event.target.value)}
      />
    </Modal>
  )
})

MessageEditorModal.displayName = 'MessageEditorModal'

export default MessageEditorModal
