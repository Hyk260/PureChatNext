import { ActionIcon, Button, Flex, InputPassword, Modal, Text } from '@pure/ui'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'

export const parseApiKeys = (value: string) => [
  ...new Set(
    value
      .split(/[,\n]/)
      .map((key) => key.trim())
      .filter(Boolean)
  ),
]

export function ApiKeysModal({
  keys,
  onSave,
  onClose,
}: {
  keys: string[]
  onSave: (keys: string[]) => Promise<boolean>
  onClose: () => void
}) {
  const [draft, setDraft] = useState(keys)
  const [saving, setSaving] = useState(false)
  const { message } = useApp()
  const save = async () => {
    if (draft.some((key) => !key.trim())) {
      message.error('请填写密钥或删除空白行')
      return
    }
    setSaving(true)
    try {
      if (await onSave([...new Set(draft.map((key) => key.trim()))])) onClose()
    } finally {
      setSaving(false)
    }
  }
  const copy = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key)
      message.success('已复制')
    } catch {
      message.error('复制失败')
    }
  }
  return (
    <Modal
      open
      title='API 密钥列表'
      width={560}
      onCancel={onClose}
      footer={
        <Flex className='justify-end gap-2'>
          <Button onClick={onClose}>取消</Button>
          <Button type='primary' loading={saving} onClick={save}>
            保存
          </Button>
        </Flex>
      }
    >
      <Flex className='max-h-[60vh] flex-col gap-3 overflow-auto py-2'>
        {draft.length === 0 && <Text type='secondary'>尚未填写用户密钥，将继承服务器配置。</Text>}
        {draft.map((key, index) => (
          <Flex key={index} className='items-center gap-2'>
            <InputPassword
              aria-label={`密钥 ${index + 1}`}
              value={key}
              onChange={(event) => setDraft(draft.map((item, i) => (i === index ? event.target.value : item)))}
            />
            <ActionIcon
              aria-label='复制密钥'
              icon={Copy}
              title='复制密钥'
              disabled={saving || !key}
              onClick={() => copy(key)}
            />
            <ActionIcon
              disabled={saving}
              aria-label='删除密钥'
              icon={Trash2}
              title='删除密钥'
              onClick={() => setDraft(draft.filter((_, i) => i !== index))}
            />
          </Flex>
        ))}
        <Button icon={Plus} disabled={saving || draft.length >= 50} onClick={() => setDraft([...draft, ''])}>
          添加密钥
        </Button>
        <Text type='secondary' fontSize={12}>
          重复密钥会合并；多个密钥按请求轮询使用。
        </Text>
      </Flex>
    </Modal>
  )
}
