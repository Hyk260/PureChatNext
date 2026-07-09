'use client'

import { Button, Modal, SortableList } from '@lobehub/ui'
import { Flexbox } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { Plus } from 'lucide-react'
import { memo } from 'react'

import type { HomeAgentGroup } from '@/features/home/store/sidebarDefaults'
import { useHomeStore } from '@/features/home/store/useHomeStore'

import GroupItem from './GroupItem'

const styles = createStaticStyles(({ css }) => ({
  item: css`
    height: 36px;
    padding-inline: 8px;
    border-radius: ${cssVar.borderRadius};
    transition: background 0.2s ease-in-out;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
}))

interface ConfigGroupModalProps {
  onCancel: () => void
  open: boolean
}

const ConfigGroupModal = memo<ConfigGroupModalProps>(({ onCancel, open }) => {
  const addAgentGroup = useHomeStore((s) => s.addAgentGroup)
  const agentGroups = useHomeStore((s) => s.agentGroups)
  const updateAgentGroupSort = useHomeStore((s) => s.updateAgentGroupSort)

  return (
    <Modal footer={null} open={open} title='分类管理' width={400} onCancel={onCancel}>
      <Flexbox>
        <SortableList
          items={agentGroups}
          renderItem={(item: HomeAgentGroup) => (
            <SortableList.Item
              horizontal
              align='center'
              className={styles.item}
              gap={4}
              id={item.id}
              justify='space-between'
            >
              <GroupItem {...item} canRemove={agentGroups.length > 1} />
            </SortableList.Item>
          )}
          onChange={(items: HomeAgentGroup[]) => updateAgentGroupSort(items)}
        />
        <Button
          block
          icon={Plus}
          onClick={() => addAgentGroup(`分类 ${agentGroups.length + 1}`)}
        >
          新建分类
        </Button>
      </Flexbox>
    </Modal>
  )
})

ConfigGroupModal.displayName = 'ConfigGroupModal'

export default ConfigGroupModal
