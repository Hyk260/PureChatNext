'use client'

import { Modal, Input } from '@lobehub/ui'
import { memo, useState } from 'react'

interface LibraryModalProps {
  onClose: () => void
  onSubmit: (name: string, description?: string) => Promise<void>
  open: boolean
  title: string
}

const LibraryModal = memo<LibraryModalProps>(({ onClose, onSubmit, open, title }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleOk = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      await onSubmit(name.trim(), description.trim() || undefined)
      setName('')
      setDescription('')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      confirmLoading={loading}
      open={open}
      title={title}
      onCancel={onClose}
      onOk={() => handleOk()}
    >
      <Input placeholder='名称' value={name} onChange={(e) => setName(e.target.value)} />
      <Input
        placeholder='描述（可选）'
        style={{ marginTop: 8 }}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
    </Modal>
  )
})

LibraryModal.displayName = 'LibraryModal'

export default LibraryModal
