'use client'

import { ActionIcon, Block, Flexbox, Input, Modal, Text } from '@lobehub/ui'
import { Popconfirm } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { Pencil, Trash2 } from 'lucide-react'
import { memo, useState } from 'react'
import type { MouseEvent } from 'react'

import type { LocalChatTopic } from '@/features/chat/types'

const styles = createStaticStyles(({ css }) => ({
  item: css`
    cursor: pointer;
    user-select: none;

    & .topic-actions {
      opacity: 0;
      transition: opacity 0.15s;
      pointer-events: none;
    }

    &:hover .topic-actions {
      opacity: 1;
      pointer-events: auto;
    }
  `,
}))

type Props = {
  active: boolean
  topic: LocalChatTopic
  onSelect: (topicId: string) => void
  onRename: (id: string, title: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
}

const TopicItem = memo<Props>(({ active, topic, onSelect, onRename, onDelete }) => {
  const [renameOpen, setRenameOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState(topic.title)
  const [saving, setSaving] = useState(false)

  const handleOpenRename = (event: MouseEvent) => {
    event.stopPropagation()
    setDraftTitle(topic.title)
    setRenameOpen(true)
  }

  const handleSubmitRename = async () => {
    const next = draftTitle.trim()
    if (!next || saving) return

    setSaving(true)
    try {
      await onRename(topic.id, next)
      setRenameOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = () => {
    void onDelete(topic.id)
  }

  return (
    <>
      <Block
        className={styles.item}
        paddingBlock={8}
        paddingInline={10}
        variant={active ? 'filled' : 'borderless'}
        onClick={() => onSelect(topic.id)}
      >
        <Flexbox align='center' gap={4} horizontal>
          <Text
            color={active ? cssVar.colorText : cssVar.colorTextSecondary}
            ellipsis={{ tooltipWhenOverflow: true }}
            style={{ flex: 1, minWidth: 0 }}
          >
            {topic.title}
          </Text>
          <Flexbox align='center' className='topic-actions' gap={2} horizontal>
            <ActionIcon
              icon={Pencil}
              size={16}
              title='重命名'
              onClick={handleOpenRename}
            />
            <Popconfirm
              cancelText='取消'
              okButtonProps={{ danger: true }}
              okText='删除'
              onConfirm={handleConfirmDelete}
              onCancel={(event?: MouseEvent) => event?.stopPropagation()}
              onPopupClick={(event) => event.stopPropagation()}
              title='删除该话题？'
              description='话题下的所有消息将一并删除。'
            >
              <ActionIcon
                icon={Trash2}
                size={16}
                title='删除'
                onClick={(event) => event.stopPropagation()}
              />
            </Popconfirm>
          </Flexbox>
        </Flexbox>
      </Block>

      <Modal
        confirmLoading={saving}
        open={renameOpen}
        title='重命名话题'
        onCancel={() => setRenameOpen(false)}
        onOk={() => void handleSubmitRename()}
      >
        <Input
          onChange={(event) => setDraftTitle(event.target.value)}
          onPressEnter={() => void handleSubmitRename()}
          placeholder='话题名称'
          value={draftTitle}
        />
      </Modal>
    </>
  )
})

TopicItem.displayName = 'TopicItem'

export default TopicItem
