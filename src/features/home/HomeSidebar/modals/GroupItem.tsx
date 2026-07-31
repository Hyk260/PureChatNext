'use client'

import { ActionIcon, confirmModal, EditableText, SortableList } from '@pure/ui'
import { createStaticStyles } from 'antd-style'
import { PencilLine, Trash } from 'lucide-react'
import { memo, useCallback, useRef, useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import type { HomeAgentGroup } from '@/features/home/store/sidebarDefaults'
import { useHomeStore } from '@/features/home/store/useHomeStore'

const styles = createStaticStyles(({ css }) => ({
  editor: css`
    flex: 1;
    min-width: 0;
  `,
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
  const { message } = useApp()
  const [editing, setEditing] = useState(false)
  const draftRef = useRef(name)
  const committedRef = useRef(false)
  // Reset/Save 的 mousedown 会先让 input blur，需跳过这次失焦提交
  const skipBlurCommitRef = useRef(false)
  const removeAgentGroup = useHomeStore((s) => s.removeAgentGroup)
  const updateAgentGroupName = useHomeStore((s) => s.updateAgentGroupName)

  const startEditing = useCallback(() => {
    draftRef.current = name
    committedRef.current = false
    skipBlurCommitRef.current = false
    setEditing(true)
  }, [name])

  const commitName = useCallback(
    (raw: string) => {
      if (committedRef.current) return
      committedRef.current = true

      const nextName = raw.trim()

      if (!nextName) {
        message.warning('分类名称不能为空')
        setEditing(false)
        return
      }

      if (nextName.length > 20) {
        message.warning('分类名称不能超过 20 个字符')
        setEditing(false)
        return
      }

      if (nextName !== name) {
        updateAgentGroupName(id, nextName)
        message.success('分类已重命名')
      }

      setEditing(false)
    },
    [id, message, name, updateAgentGroupName]
  )

  return (
    <>
      <SortableList.DragHandle />
      {!editing ? (
        <>
          <span className={styles.title}>{name}</span>
          <ActionIcon icon={PencilLine} size='small' onClick={startEditing} />
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
        <div
          className={styles.editor}
          onMouseDown={(event) => {
            const target = event.target as HTMLElement | null
            // ControlInput 后缀的 Reset / Save
            if (target?.closest('button, [role="button"]')) {
              skipBlurCommitRef.current = true
            }
          }}
        >
          <EditableText
            editing={editing}
            showEditIcon={false}
            style={{ height: 28 }}
            value={name}
            onBlur={() => {
              // 延后一拍：等 Reset/Save click、ESC 的 onEditingChange 先落地
              window.setTimeout(() => {
                if (committedRef.current) return

                if (skipBlurCommitRef.current) {
                  skipBlurCommitRef.current = false
                  // Reset 只改内部 input，不会触发 onValueChanging，这里同步回原始值
                  draftRef.current = name
                  return
                }

                commitName(draftRef.current)
              }, 0)
            }}
            onChangeEnd={commitName}
            onEditingChange={(next) => {
              if (!next) {
                committedRef.current = true
                setEditing(false)
                return
              }
              setEditing(true)
            }}
            onValueChanging={(value) => {
              draftRef.current = value
            }}
          />
        </div>
      )}
    </>
  )
})

GroupItem.displayName = 'GroupItem'

export default GroupItem
