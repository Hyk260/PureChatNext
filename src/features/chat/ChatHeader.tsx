'use client'

import { ActionIcon, DropdownMenu, Flexbox, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { Maximize2, MoreHorizontal, PanelLeftOpen, PanelRightOpen } from 'lucide-react'
import { memo, useMemo } from 'react'

import { useChatUiStore } from '@/features/chat/store/useChatUiStore'

const styles = createStaticStyles(({ css }) => ({
  header: css`
    flex: none;
    height: 44px;
    padding-inline: 8px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
  `,
  title: css`
    min-width: 0;
    margin-inline-start: 4px;
    font-size: 14px;
    font-weight: 600;
  `,
}))

type Props = {
  title: string
}

const ChatHeader = memo<Props>(({ title }) => {
  const leftCollapsed = useChatUiStore((s) => s.leftCollapsed)
  const rightCollapsed = useChatUiStore((s) => s.rightCollapsed)
  const wideScreen = useChatUiStore((s) => s.wideScreen)
  const toggleLeftCollapsed = useChatUiStore((s) => s.toggleLeftCollapsed)
  const toggleRightCollapsed = useChatUiStore((s) => s.toggleRightCollapsed)
  const toggleWideScreen = useChatUiStore((s) => s.toggleWideScreen)

  const menuItems = useMemo(
    () => [
      {
        checked: wideScreen,
        icon: Maximize2,
        key: 'full-width',
        label: '全宽显示',
        onCheckedChange: (checked: boolean) => toggleWideScreen(checked),
        type: 'switch' as const,
      },
    ],
    [toggleWideScreen, wideScreen],
  )

  return (
    <Flexbox horizontal align='center' className={styles.header} justify='space-between'>
      <Flexbox horizontal align='center' flex={1} gap={2} style={{ minWidth: 0, overflow: 'hidden' }}>
        {leftCollapsed ? (
          <ActionIcon
            icon={PanelLeftOpen}
            size='small'
            title='展开话题栏'
            onClick={toggleLeftCollapsed}
          />
        ) : null}
        <Text className={styles.title} ellipsis>
          {title}
        </Text>
        <DropdownMenu items={menuItems} nativeButton placement='bottomLeft'>
          <ActionIcon icon={MoreHorizontal} size='small' title='更多' />
        </DropdownMenu>
      </Flexbox>

      <Flexbox horizontal align='center' flex='none' gap={2}>
        {rightCollapsed ? (
          <ActionIcon
            icon={PanelRightOpen}
            size='small'
            title='展开参数栏'
            onClick={toggleRightCollapsed}
          />
        ) : null}
      </Flexbox>
    </Flexbox>
  )
})

ChatHeader.displayName = 'ChatHeader'

export default ChatHeader
