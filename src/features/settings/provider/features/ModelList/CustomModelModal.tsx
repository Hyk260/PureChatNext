'use client'

import { Input, Modal, Text } from '@pure/ui'
import { memo, useEffect, useMemo, useState } from 'react'

interface CustomModelModalProps {
  existingModelIds: string[]
  open: boolean
  onAdd: (model: { displayName: string; id: string }) => void
  onCancel: () => void
}

const CustomModelModal = memo<CustomModelModalProps>(({ existingModelIds, open, onAdd, onCancel }) => {
  const [displayName, setDisplayName] = useState('')
  const [modelId, setModelId] = useState('')
  const normalizedModelId = modelId.trim()
  const duplicate = useMemo(
    () => existingModelIds.some((id) => id.toLowerCase() === normalizedModelId.toLowerCase()),
    [existingModelIds, normalizedModelId]
  )

  useEffect(() => {
    if (!open) return
    setDisplayName('')
    setModelId('')
  }, [open])

  const handleSubmit = () => {
    if (!normalizedModelId || duplicate) return
    onAdd({ displayName: displayName.trim() || normalizedModelId, id: normalizedModelId })
  }

  return (
    <Modal
      destroyOnHidden
      okButtonProps={{ disabled: !normalizedModelId || duplicate }}
      okText='添加'
      open={open}
      title='添加自定义 AI 模型'
      width={440}
      onCancel={onCancel}
      onOk={handleSubmit}
    >
      <div className='flex flex-col gap-4 py-2'>
        <label className='flex flex-col gap-2'>
          <span className='text-sm font-medium'>模型名称</span>
          <Input
            autoFocus
            placeholder='例如：我的模型'
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>

        <label className='flex flex-col gap-2'>
          <span className='text-sm font-medium'>模型 ID</span>
          <Input
            placeholder='例如：my-model'
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            onPressEnter={handleSubmit}
          />
          {duplicate ? <Text type='danger'>该模型 ID 已存在</Text> : null}
        </label>

        <Text type='secondary'>自定义模型会保存在当前浏览器中，并使用当前服务商的 API 配置。</Text>
      </div>
    </Modal>
  )
})

CustomModelModal.displayName = 'CustomModelModal'

export default CustomModelModal
