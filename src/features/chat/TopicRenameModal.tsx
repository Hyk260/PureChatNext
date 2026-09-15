'use client'

import { confirmModal, Input, Modal, Text, Flex } from '@pure/ui'
import { memo, useCallback, useState } from 'react'

/**
 * State + handlers for the "rename topic" modal. Caller binds the topic id
 * via the `onRename(title)` callback so this hook stays id-agnostic.
 */
export function useTopicRename(onRename: (title: string) => void | Promise<void>) {
  const [open, setOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const openRename = useCallback((currentTitle: string) => {
    setDraftTitle(currentTitle)
    setOpen(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  const submit = useCallback(async () => {
    const next = draftTitle.trim()
    if (!next || saving) return
    setSaving(true)
    try {
      await onRename(next)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }, [draftTitle, onRename, saving])

  return { open, draftTitle, saving, openRename, close, setDraftTitle, submit }
}

interface TopicRenameModalProps {
  open: boolean
  draftTitle: string
  saving: boolean
  onDraftTitleChange: (value: string) => void
  onCancel: () => void
  onOk: () => void
}

/**
 * Shared "rename topic" modal. Used by ChatHeader and TopicItem.
 */
const TopicRenameModal = memo<TopicRenameModalProps>(
  ({ open, draftTitle, saving, onDraftTitleChange, onCancel, onOk }) => (
    <Modal
      cancelText='取消'
      confirmLoading={saving}
      destroyOnHidden
      okButtonProps={{ disabled: !draftTitle.trim() }}
      okText='保存'
      open={open}
      title='重命名话题'
      width={400}
      onCancel={onCancel}
      onOk={onOk}
    >
      <Flex className='flex-col gap-3 py-2'>
        <Text type='secondary'>保持简短且易于识别。</Text>
        <Input
          autoFocus
          maxLength={100}
          placeholder='话题名称'
          value={draftTitle}
          onChange={(event) => onDraftTitleChange(event.target.value)}
          onPressEnter={onOk}
        />
      </Flex>
    </Modal>
  )
)

TopicRenameModal.displayName = 'TopicRenameModal'

export default TopicRenameModal

/**
 * Shared "delete topic" confirmation. Caller passes the bound delete callback.
 */
export function confirmDeleteTopic(onDelete: () => void | Promise<void>) {
  confirmModal({
    cancelText: '取消',
    content: '话题下的所有消息将一并删除。',
    okButtonProps: { danger: true },
    okText: '删除',
    onOk: () => onDelete(),
    title: '删除该话题？',
  })
}
