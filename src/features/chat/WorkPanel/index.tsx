'use client'

import { ActionIcon, DropdownMenu, Flex, Icon } from '@pure/ui'
import type { DropdownItem } from '@pure/ui'
import { createStaticStyles, cssVar } from '@lobehub/ui'
import { Check, PanelRightClose, Plus } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useReducer, useState } from 'react'

import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import type { ChatLlmParams, LocalChatTopic } from '@/features/chat/types'
import { getDesktopApi } from '@/types/desktop'
import type { DesktopProject } from '@/types/desktop'

import FilePreview from './FilePreview'
import FilesContent from './FilesContent'
import { EMPTY_FILE_TABS, fileTabsReducer } from './previewUtils'
import OverviewContent from './OverviewContent'
import ParamsContent from './ParamsContent'
import WorkPanelTab from './WorkPanelTab'
import type { WorkPanelTabId } from './tabs'
import { CONFIG_MENU_TABS, WORK_PANEL_TAB_BY_ID, WORKSPACE_MENU_TABS } from './tabs'

// 保留样式：标题栏依赖嵌套选择器和滚动条，预览分栏宽度随打开状态调整。
const styles = createStaticStyles(({ css }) => ({
  // 保留 createStaticStyles：该主题色暂无对应的语义 Tailwind token。
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
  workspace: css`
    width: 320px;
    max-width: 100%;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    &[data-preview-open='true'] {
      width: min(960px, 68vw);
    }
  `,
  panel: css`
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    [data-preview-open='true'] > & {
      flex: 0 0 min(280px, 36%);
    }
  `,
}))

type Props = {
  onChange: (patch: Partial<ChatLlmParams>) => void
  topic: LocalChatTopic | null
  topicTitle: string
  value: ChatLlmParams
}

const WorkPanelWorkspace = memo<Props>(({ value, onChange, topic, topicTitle }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [project, setProject] = useState<DesktopProject | null>(null)
  const [projectLoading, setProjectLoading] = useState(Boolean(topic?.projectName))
  const [projectError, setProjectError] = useState<string | null>(null)
  const [fileTabs, dispatchFileTabs] = useReducer(fileTabsReducer, EMPTY_FILE_TABS)
  const openTabs = useChatUiStore((s) => s.workPanelOpenTabs)
  const activeTab = useChatUiStore((s) => s.workPanelActiveTab)
  const openWorkPanelTab = useChatUiStore((s) => s.openWorkPanelTab)
  const closeWorkPanelTab = useChatUiStore((s) => s.closeWorkPanelTab)
  const setWorkPanelActiveTab = useChatUiStore((s) => s.setWorkPanelActiveTab)
  const toggleRightCollapsed = useChatUiStore((s) => s.toggleRightCollapsed)

  useEffect(() => {
    let cancelled = false
    const api = getDesktopApi()
    if (!api?.listProjects || !topic?.projectName) {
      setProjectLoading(false)
      return
    }
    api
      .listProjects()
      .then((projects) => {
        if (!cancelled) setProject(projects.find((item) => item.name === topic.projectName) ?? null)
      })
      .catch((error) => {
        if (!cancelled) setProjectError(error instanceof Error ? error.message : '加载项目失败')
      })
      .finally(() => {
        if (!cancelled) setProjectLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [topic?.projectName])

  const handleOpenFile = useCallback((path: string) => dispatchFileTabs({ type: 'open', path }), [])

  const handleToggleMenuTab = useCallback(
    (tabId: WorkPanelTabId) => {
      if (openTabs.includes(tabId)) {
        closeWorkPanelTab(tabId)
      } else {
        openWorkPanelTab(tabId)
      }
      setMenuOpen(false)
    },
    [closeWorkPanelTab, openTabs, openWorkPanelTab]
  )

  const menuItems = useMemo<DropdownItem[]>(() => {
    const toMenuChildren = (tabs: typeof WORKSPACE_MENU_TABS) =>
      tabs.map((tab) => ({
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
        return null
      case 'params':
        return <ParamsContent value={value} onChange={onChange} />
      default:
        return null
    }
  }, [activeTab, onChange, topic, topicTitle, value])

  return (
    <Flex className={styles.workspace} data-preview-open={Boolean(fileTabs.activePath)}>
      <Flex className={[styles.panel, 'flex-col']}>
        <Flex className={[styles.header, 'items-center gap-1']}>
          <Flex className={[styles.tabs, 'flex-1 items-center gap-1']}>
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
        <Flex className='flex-col flex-1 min-h-0 overflow-hidden'>
          {content}
          <div className='h-full min-h-0' hidden={activeTab !== 'files'}>
            <FilesContent
              activePath={fileTabs.activePath}
              error={projectError}
              key={project?.id ?? 'no-project'}
              loading={projectLoading}
              onOpenFile={handleOpenFile}
              project={project}
            />
          </div>
        </Flex>
      </Flex>
      {project && fileTabs.activePath ? (
        <FilePreview dispatch={dispatchFileTabs} project={project} tabs={fileTabs} />
      ) : null}
    </Flex>
  )
})

WorkPanelWorkspace.displayName = 'WorkPanelWorkspace'

const WorkPanel = memo<Props>((props) => <WorkPanelWorkspace key={props.topic?.projectName ?? ''} {...props} />)

WorkPanel.displayName = 'WorkPanel'

export default WorkPanel
