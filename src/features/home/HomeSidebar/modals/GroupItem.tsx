'use client'

import { ActionIcon, EditableText, SortableList } from '@lobehub/ui'
import { confirmModal } from '@/libs/modal'
import { App } from 'antd'
import { createStaticStyles } from 'antd-style'
import { PencilLine, Trash } from 'lucide-react'
import { memo, useState } from 'react'

import type { HomeAgentGroup } from '@/features/home/store/sidebarDefaults'
import { useHomeStore } from '@/features/home/store/useHomeStore'

const styles = createStaticStyles(({ css }) => ({
  title: css`
    flex: 1;
    height: 28px;
    line-height: 28px;
    text-align: start;
  `,
}))

interface GroupItemProps extends HomeAgentGroup {
  canRemove: boolean
}

const GroupItem = memo<GroupItemProps>(({ canRemove, id, name }) => {
  const { message } = App.useApp()
  const [editing, setEditing] = useState(false)
  const removeAgentGroup = useHomeStore((s) => s.removeAgentGroup)
  const updateAgentGroupName = useHomeStore((s) => s.updateAgentGroupName)

  return (
    <>
      <SortableList.DragHandle />
      {!editing ? (
        <>
          <span className={styles.title}>{name}</span>
          <ActionIcon icon={PencilLine} size='small' onClick={() => setEditing(true)} />
          <ActionIcon
            disabled={!canRemove}
            icon={Trash}
            size='small'
            onClick={() => {
              if (!canRemove) return

              confirmModal({
                cancelText: '取消',
                content: '删除后，该分类下的助理将移至默认分类。',
                okButtonProps: { danger: true },
                okText: '删除',
                onOk: () => removeAgentGroup(id),
                title: '删除分类',
              })
            }}
          />
        </>
      ) : (
        <EditableText
          editing={editing}
          showEditIcon={false}
          style={{ height: 28 }}
          value={name}
          onEditingChange={setEditing}
          onChangeEnd={(input) => {
            const nextName = input.trim()

            if (!nextName) {
              message.warning('分类名称不能为空')
              return
            }

            if (nextName.length > 20) {
              message.warning('分类名称不能超过 20 个字符')
              return
            }

            if (nextName !== name) {
              updateAgentGroupName(id, nextName)
              message.success('分类已重命名')
            }

            setEditing(false)
          }}
        />
      )}
    </>
  )
})

GroupItem.displayName = 'GroupItem'

export default GroupItem
