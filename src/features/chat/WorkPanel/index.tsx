'use client'

import { ActionIcon, DropdownMenu, Flex, Icon } from '@pure/ui'
import type { MenuProps } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { Check, PanelRightClose, Plus } from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'

import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import type { ChatLlmParams, LocalChatTopic } from '@/features/chat/types'

import FilesContent from './FilesContent'
import OverviewContent from './OverviewContent'
import ParamsContent from './ParamsContent'
import WorkPanelTab from './WorkPanelTab'
import type { WorkPanelTabId } from './tabs'
import { CONFIG_MENU_TABS, WORK_PANEL_TAB_BY_ID, WORKSPACE_MENU_TABS } from './tabs'

// 标题栏与滚动条隐藏：嵌套选择器与伪元素，保留 createStaticStyles
const styles = createStaticStyles(({ css }) => ({
  addTrigger: css`
    color: ${cssVar.colorTextSecondary};
  `,
  header: css`
    flex: none;
    height: 40px;
    padding-inline: 8px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  tabs: css`
    min-width: 0;
    overflow-x: auto;

    &::-webkit-scrollbar {
      display: none;
    }
  `,
}))

type Props = {
  onChange: (patch: Partial<ChatLlmParams>) => void
  topic: LocalChatTopic | null
  topicTitle: string
  value: ChatLlmParams
}

const WorkPanel = memo<Props>(({ value, onChange, topic, topicTitle }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const openTabs = useChatUiStore((s) => s.workPanelOpenTabs)
  const activeTab = useChatUiStore((s) => s.workPanelActiveTab)
  const openWorkPanelTab = useChatUiStore((s) => s.openWorkPanelTab)
  const closeWorkPanelTab = useChatUiStore((s) => s.closeWorkPanelTab)
  const setWorkPanelActiveTab = useChatUiStore((s) => s.setWorkPanelActiveTab)
  const toggleRightCollapsed = useChatUiStore((s) => s.toggleRightCollapsed)

  const handleToggleMenuTab = useCallback(
    (tabId: WorkPanelTabId) => {
      const meta = WORK_PANEL_TAB_BY_ID[tabId]
      if (!meta.implemented) return
      if (openTabs.includes(tabId)) {
        closeWorkPanelTab(tabId)
      } else {
        openWorkPanelTab(tabId)
      }
      setMenuOpen(false)
    },
    [closeWorkPanelTab, openTabs, openWorkPanelTab]
  )

  const menuItems = useMemo<MenuProps['items']>(() => {
    const toMenuChildren = (tabs: typeof WORKSPACE_MENU_TABS) =>
      tabs.map((tab) => ({
        disabled: !tab.implemented,
        icon: openTabs.includes(tab.id) ? <Icon icon={Check} /> : <Icon icon={tab.icon} />,
        key: tab.id,
        label: tab.label,
        onClick: () => handleToggleMenuTab(tab.id),
      }))

    return [
      {
        children: toMenuChildren(WORKSPACE_MENU_TABS),
        key: 'workspace',
        label: '工作区',
        type: 'group',
      },
      { type: 'divider' },
      {
        children: toMenuChildren(CONFIG_MENU_TABS),
        key: 'config',
        label: '配置',
        type: 'group',
      },
    ]
  }, [handleToggleMenuTab, openTabs])

  const content = useMemo(() => {
    switch (activeTab) {
      case 'overview':
        return <OverviewContent topic={topic} topicTitle={topicTitle} />
      case 'files':
        return <FilesContent topic={topic} />
      case 'params':
        return <ParamsContent value={value} onChange={onChange} />
      default:
        return null
    }
  }, [activeTab, onChange, topic, topicTitle, value])

  return (
    <Flex className='flex-col h-full overflow-hidden w-[320px]'>
      <Flex className={[styles.header, 'flex-row items-center gap-1']}>
        <Flex className={[styles.tabs, 'flex-1 flex-row items-center gap-1']}>
          {openTabs.map((tabId) => {
            const meta = WORK_PANEL_TAB_BY_ID[tabId]
            return (
              <WorkPanelTab
                active={tabId === activeTab}
                key={tabId}
                label={meta.label}
                onClose={() => closeWorkPanelTab(tabId)}
                onSelect={() => setWorkPanelActiveTab(tabId)}
              />
            )
          })}
          <DropdownMenu items={menuItems} open={menuOpen} placement='bottomLeft' onOpenChange={setMenuOpen}>
            <ActionIcon className={styles.addTrigger} icon={Plus} size='small' title='添加面板' />
          </DropdownMenu>
        </Flex>
        <ActionIcon icon={PanelRightClose} size='small' title='折叠工作面板' onClick={toggleRightCollapsed} />
      </Flex>
      <Flex className='flex-col flex-1 min-h-0 overflow-hidden'>{content}</Flex>
    </Flex>
  )
})

WorkPanel.displayName = 'WorkPanel'

export default WorkPanel
