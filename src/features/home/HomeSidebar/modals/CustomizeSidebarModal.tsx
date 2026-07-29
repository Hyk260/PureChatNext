'use client'

import { Button, Flex } from 'antd'
import { ActionIcon, Icon, SortableList, Text, Tooltip } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { ArrowDownToLine, Eye, EyeOff, PinIcon, RotateCcw } from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'

import {
  DEFAULT_SIDEBAR_ITEMS,
  findSidebarSection,
  normalizeSidebarItems,
  SIDEBAR_ACCORDION_KEYS,
  SIDEBAR_SPACER_ID,
} from '@/const/home/nav'
import { DEFAULT_HIDDEN_SIDEBAR_SECTIONS } from '@/features/home/store/sidebarDefaults'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { modal } from '@/components/AntdStaticMethods'

const styles = createStaticStyles(({ css }) => ({
  accordionGroup: css`
    margin-inline: -5px;
    padding: 4px;
    border: 1px dashed ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};
  `,
  footer: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding-block-start: 16px;
  `,
  item: css`
    height: 40px;
    padding-inline: 8px;
    border-radius: ${cssVar.borderRadius};
    transition: background 0.2s ease-in-out;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  spacerLine: css`
    flex: 1;
    block-size: 1px;
    background: ${cssVar.colorBorderSecondary};
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
      <Flex align='center' gap={8}>
        <SortableList.DragHandle />
        {section.icon ? <Icon icon={section.icon} size={18} /> : null}
        <Text>{section.title}</Text>
      </Flex>
      {section.alwaysVisible ? (
        <Tooltip title='固定显示'>
          <ActionIcon icon={PinIcon} size='small' style={{ cursor: 'default', opacity: 0.45 }} />
        </Tooltip>
      ) : (
        <Tooltip title={isHidden ? '已隐藏' : '显示中'}>
          <ActionIcon icon={isHidden ? EyeOff : Eye} size='small' onClick={() => onToggle(item.id)} />
        </Tooltip>
      )}
    </SortableList.Item>
  )
})

SidebarSortableItemRow.displayName = 'SidebarSortableItemRow'

const BoundSpacerItem = memo(() => (
  <Flex align='center' className={styles.item} gap={8}>
    <Icon icon={ArrowDownToLine} size={14} style={{ color: cssVar.colorTextQuaternary }} />
    <div className={styles.spacerLine} />
    <Text type='secondary' style={{ fontSize: 12 }}>
      下方条目锚定到底部
    </Text>
    <div className={styles.spacerLine} />
  </Flex>
))

BoundSpacerItem.displayName = 'BoundSpacerItem'

const splitSidebarItems = (items: string[]) => {
  const innerItems: SidebarSortableItem[] = []
  const bottomItems: SidebarSortableItem[] = []
  let pastSpacer = false

  for (const id of items) {
    if (id === SIDEBAR_SPACER_ID) {
      pastSpacer = true
      continue
    }
    if (SIDEBAR_ACCORDION_KEYS.has(id)) {
      innerItems.push({ id })
    } else if (pastSpacer) {
      bottomItems.push({ id })
    }
  }

  return { bottomItems, innerItems }
}

interface CustomizeSidebarContentProps {
  close: () => void
}

const CustomizeSidebarContent = memo<CustomizeSidebarContentProps>(({ close }) => {
  const storeItems = useHomeStore((s) => s.sidebarItems)
  const storeHiddenSections = useHomeStore((s) => s.hiddenSidebarSections)
  const setSidebarItems = useHomeStore((s) => s.setSidebarItems)
  const setHiddenSidebarSections = useHomeStore((s) => s.setHiddenSidebarSections)

  const [items, setItems] = useState(() => normalizeSidebarItems(storeItems))
  const [hiddenSections, setHiddenSections] = useState(storeHiddenSections)

  const { bottomItems, innerItems } = useMemo(() => splitSidebarItems(items), [items])

  const toggleSection = useCallback((key: string) => {
    setHiddenSections((prev) => {
      const isHidden = prev.includes(key)
      return isHidden ? prev.filter((k) => k !== key) : [...prev, key]
    })
  }, [])

  const handleInnerChange = useCallback((nextInner: SidebarSortableItem[]) => {
    setItems((prev) => {
      const { bottomItems: bottoms } = splitSidebarItems(prev)
      return normalizeSidebarItems([
        ...nextInner.map((item) => item.id),
        SIDEBAR_SPACER_ID,
        ...bottoms.map((item) => item.id),
      ])
    })
  }, [])

  const handleBottomChange = useCallback((nextBottom: SidebarSortableItem[]) => {
    setItems((prev) => {
      const { innerItems: inners } = splitSidebarItems(prev)
      return normalizeSidebarItems([
        ...inners.map((item) => item.id),
        SIDEBAR_SPACER_ID,
        ...nextBottom.map((item) => item.id),
      ])
    })
  }, [])

  const handleResetDefault = useCallback(() => {
    setItems(DEFAULT_SIDEBAR_ITEMS)
    setHiddenSections(DEFAULT_HIDDEN_SIDEBAR_SECTIONS)
  }, [])

  const handleConfirm = useCallback(() => {
    setSidebarItems(normalizeSidebarItems(items))
    setHiddenSidebarSections(hiddenSections)
    close()
  }, [close, hiddenSections, items, setHiddenSidebarSections, setSidebarItems])

  return (
    <>
      <Flex vertical gap={2}>
        <div className={styles.accordionGroup}>
          <Flex vertical gap={2}>
            <SortableList
              items={innerItems}
              renderItem={(item: SidebarSortableItem) => (
                <SidebarSortableItemRow
                  hiddenSections={hiddenSections}
                  item={item}
                  key={item.id}
                  onToggle={toggleSection}
                />
              )}
              onChange={handleInnerChange}
            />
            <BoundSpacerItem />
          </Flex>
        </div>

        <SortableList
          items={bottomItems}
          renderItem={(item: SidebarSortableItem) => (
            <SidebarSortableItemRow
              hiddenSections={hiddenSections}
              item={item}
              key={item.id}
              onToggle={toggleSection}
            />
          )}
          onChange={handleBottomChange}
        />
      </Flex>

      <div className={styles.footer}>
        <Button block icon={<Icon icon={RotateCcw} size={14} />} onClick={handleResetDefault}>
          恢复默认
        </Button>
        <Button block type='primary' onClick={handleConfirm}>
          确认
        </Button>
      </div>
    </>
  )
})

CustomizeSidebarContent.displayName = 'CustomizeSidebarContent'

export const openCustomizeSidebarModal = () => {
  const instance = modal.info({
    content: <CustomizeSidebarContent close={() => instance.destroy()} />,
    footer: null,
    icon: null,
    maskClosable: true,
    title: '自定义侧边栏',
    width: 360,
  })
  return instance
}
