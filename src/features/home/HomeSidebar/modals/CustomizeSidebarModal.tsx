'use client'

import {
  ActionIcon,
  Button,
  Flexbox,
  Icon,
  SortableList,
  Text,
  Tooltip,
} from '@lobehub/ui'
import type { ModalInstance } from '@lobehub/ui/base-ui'

import { createModal } from '@/libs/modal'
import { createStaticStyles, cssVar } from 'antd-style'
import { Eye, EyeOff, PinIcon, RotateCcw } from 'lucide-react'
import { memo, useMemo } from 'react'

import { findSidebarSection } from '@/const/home/nav'
import { useHomeStore } from '@/features/home/store/useHomeStore'

const styles = createStaticStyles(({ css }) => ({
  item: css`
    height: 40px;
    padding-inline: 8px;
    border-radius: ${cssVar.borderRadius};
    transition: background 0.2s ease-in-out;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
}))

interface SidebarSortableItem {
  id: string
}

interface SidebarSortableItemProps {
  hiddenSections: string[]
  item: SidebarSortableItem
  onToggle: (key: string) => void
}

const SidebarSortableItemRow = memo<SidebarSortableItemProps>(({ hiddenSections, item, onToggle }) => {
  const section = findSidebarSection(item.id)
  if (!section) return null

  const isHidden = !section.alwaysVisible && hiddenSections.includes(item.id)

  return (
    <SortableList.Item
      horizontal
      align='center'
      className={styles.item}
      gap={8}
      id={item.id}
      justify='space-between'
      style={{ opacity: isHidden ? 0.5 : undefined }}
    >
      <Flexbox horizontal align='center' gap={8}>
        <SortableList.DragHandle />
        <Text>{section.title}</Text>
      </Flexbox>
      {section.alwaysVisible ? (
        <Tooltip title='固定显示'>
          <ActionIcon icon={PinIcon} size='small' style={{ cursor: 'default', opacity: 0.45 }} />
        </Tooltip>
      ) : (
        <Tooltip title={isHidden ? '已隐藏' : '显示中'}>
          <ActionIcon
            icon={isHidden ? EyeOff : Eye}
            size='small'
            onClick={() => onToggle(item.id)}
          />
        </Tooltip>
      )}
    </SortableList.Item>
  )
})

SidebarSortableItemRow.displayName = 'SidebarSortableItemRow'

const CustomizeSidebarContent = memo(() => {
  const hiddenSections = useHomeStore((s) => s.hiddenSidebarSections)
  const sidebarItems = useHomeStore((s) => s.sidebarItems)
  const setSidebarItems = useHomeStore((s) => s.setSidebarItems)
  const toggleHiddenSidebarSection = useHomeStore((s) => s.toggleHiddenSidebarSection)

  const availableItems = useMemo(
    () =>
      sidebarItems
        .filter((key) => Boolean(findSidebarSection(key)))
        .map((id) => ({ id })),
    [sidebarItems],
  )

  return (
    <SortableList
      items={availableItems}
      renderItem={(item: SidebarSortableItem) => (
        <SidebarSortableItemRow
          hiddenSections={hiddenSections}
          item={item}
          key={item.id}
          onToggle={toggleHiddenSidebarSection}
        />
      )}
      onChange={(items: SidebarSortableItem[]) => setSidebarItems(items.map((item) => item.id))}
    />
  )
})

CustomizeSidebarContent.displayName = 'CustomizeSidebarContent'

export const openCustomizeSidebarModal = (): ModalInstance =>
  createModal({
    content: <CustomizeSidebarContent />,
    footer: (
      <Button
        block
        icon={<Icon icon={RotateCcw} />}
        type='text'
        onClick={() => useHomeStore.getState().resetSidebarCustomization()}
      >
        恢复默认
      </Button>
    ),
    maskClosable: true,
    title: '自定义侧边栏',
    width: 360,
  })
