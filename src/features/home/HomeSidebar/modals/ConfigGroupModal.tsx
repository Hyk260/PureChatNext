'use client'

import { Button, Flexbox, SortableList } from '@lobehub/ui'
import { type ModalInstance } from '@lobehub/ui/base-ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { Plus } from 'lucide-react'
import { memo } from 'react'

import { type HomeAgentGroup } from '@/features/home/store/sidebarDefaults'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { createModal } from '@/libs/modal'

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

const ConfigGroupContent = memo(() => {
  const addAgentGroup = useHomeStore((s) => s.addAgentGroup)
  const agentGroups = useHomeStore((s) => s.agentGroups)
  const updateAgentGroupSort = useHomeStore((s) => s.updateAgentGroupSort)

  return (
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
      <Button block icon={Plus} onClick={() => addAgentGroup(`分类 ${agentGroups.length + 1}`)}>
        新建分类
      </Button>
    </Flexbox>
  )
})

ConfigGroupContent.displayName = 'ConfigGroupContent'

export const openConfigGroupModal = (): ModalInstance =>
  createModal({
    content: <ConfigGroupContent />,
    footer: null,
    maskClosable: true,
    title: '分类管理',
    width: 400,
  })
