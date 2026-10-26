'use client'

import { ActionIcon, DropdownMenu, Flex, Icon } from '@pure/ui'
import type { DropdownItem } from '@pure/ui'
import { FocusScope, createStaticStyles, cssVar, cx, toast } from '@lobehub/ui'
import { Check, PanelRightClose, Plus } from 'lucide-react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { memo, useCallback, useEffect, useMemo, useReducer, useState } from 'react'

import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import type { ChatAdvancedSettings } from '@pure/types'
import type { LocalChatTopic } from '@/features/chat/types'
import { getDesktopApi } from '@/types/desktop'
import type { DesktopProject } from '@/types/desktop'

import FilePreview from './FilePreview'
import FilesContent from './FilesContent'
import { EMPTY_FILE_TABS, fileTabsReducer } from './previewUtils'
import { PANEL_ANIMATION_DURATION, PANEL_ANIMATION_EASE, PANEL_TRANSITION } from './panelSizing'
import { useHorizontalWheel } from './useHorizontalWheel'
import { usePanelResize } from './usePanelResize'
import OverviewContent from './OverviewContent'
import AdvancedSettingsContent from './AdvancedSettingsContent'
import WorkPanelTab from './WorkPanelTab'
import type { WorkPanelTabId } from './tabs'
import { CONFIG_MENU_TABS, TOOL_MENU_TABS, WORK_PANEL_TAB_BY_ID, WORKSPACE_MENU_TABS } from './tabs'
import BrowserPane from './Browser'
import { useBrowserPanelStore } from './Browser/store'

// 保留样式：工作区动态宽度、拖拽状态与主题色需要运行时样式。
const styles = createStaticStyles(({ css }) => ({
  // 保留 createStaticStyles：该主题色暂无对应的语义 Tailwind token。
  addTrigger: css`
    color: ${cssVar.colorTextSecondary};
    min-width: 24px;
    min-height: 24px;
  `,
  header: css`
    flex: none;
    height: 40px;
    padding-inline: 8px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  workspace: css`
    position: relative;
    display: flex;
    flex: none;
    width: calc(var(--work-panel-total-width) + 1px);
    min-width: 0;
    height: 100%;
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};
    opacity: 1;
    transform: translateX(0);
    transition:
      width ${PANEL_TRANSITION},
      opacity ${PANEL_TRANSITION},
      transform ${PANEL_TRANSITION};

    [data-work-panel-shell][data-collapsed='true'] > & {
      opacity: 0;
      transform: translateX(12px);
    }
    &[data-resizing='true'] {
      transition: none;
    }
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `,
  panel: css`
    flex: none;
    width: var(--work-panel-width);
    min-width: 0;
    height: 100%;
    overflow: hidden;
    transition: width ${PANEL_TRANSITION};
    [data-resizing='true'] & {
      transition: none;
    }
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `,
  previewFrame: css`
    flex: none;
    width: var(--file-preview-width);
    min-width: 0;
    height: 100%;
    overflow: hidden;
    transition: width ${PANEL_TRANSITION};
    [data-resizing='true'] & {
      transition: none;
    }
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `,
  previewContent: css`
    width: var(--expanded-file-preview-width);
    height: 100%;
  `,
  resizeHandle: css`
    position: absolute;
    z-index: 30;
    inset-block: 0;
    inset-inline-start: 0;
    width: 6px;
    cursor: col-resize;
    touch-action: none;
    outline: none;
    // 隐藏Handle
    opacity: 0;
    &::after {
      position: absolute;
      inset-block: 0;
      inset-inline-start: 2px;
      width: 2px;
      content: '';
      opacity: 0;
      background: ${cssVar.colorPrimary};
    }
    &:hover::after,
    &:focus-visible::after {
      opacity: 0.6;
    }
  `,
  previewHandle: css`
    inset-inline-start: calc(var(--work-panel-width) - 3px);
  `,
  panelHandle: css`
    /* Native pages cover DOM handles, so keep this target on the chat side of the divider. */
    inset-inline-start: -6px;
  `,
}))

type Props = {
  userId: string
  agentId: string
  topicId: string | null
  busy: boolean
  onChange: (patch: Partial<ChatAdvancedSettings>) => void
  topic: LocalChatTopic | null
  topicTitle: string
  value: ChatAdvancedSettings
}

const WorkPanelWorkspace = memo<Props>(({ value, onChange, topic, topicTitle, userId, agentId, topicId, busy }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [project, setProject] = useState<DesktopProject | null>(null)
  const [projectLoading, setProjectLoading] = useState(Boolean(topic?.projectName))
  const [projectError, setProjectError] = useState<string | null>(null)
  const [fileTabs, dispatchFileTabs] = useReducer(fileTabsReducer, EMPTY_FILE_TABS)
  const [serverUrl, setServerUrl] = useState('')
  const browserKey = JSON.stringify([serverUrl, userId, agentId, topicId])
  const browserEntry = useBrowserPanelStore((store) => store.entries[browserKey])
  const browserOpen = useBrowserPanelStore((store) => store.open)
  const browserSetActive = useBrowserPanelStore((store) => store.setActive)
  const browserClose = useBrowserPanelStore((store) => store.close)
  const previewOpen = Boolean(project && fileTabs.activePath)
  const { isResizing, panelRef, previewRef, rootRef, separatorProps } = usePanelResize(previewOpen)
  const tabListRef = useHorizontalWheel<HTMLDivElement>()
  const reducedMotion = useReducedMotion()
  const openTabs = useChatUiStore((s) => s.workPanelOpenTabs)
  const activeTab = useChatUiStore((s) => s.workPanelActiveTab)
  const openWorkPanelTab = useChatUiStore((s) => s.openWorkPanelTab)
  const closeWorkPanelTab = useChatUiStore((s) => s.closeWorkPanelTab)
  const setWorkPanelActiveTab = useChatUiStore((s) => s.setWorkPanelActiveTab)
  const toggleRightCollapsed = useChatUiStore((s) => s.toggleRightCollapsed)
  const rightCollapsed = useChatUiStore((s) => s.rightCollapsed)
  const displayedTabs: WorkPanelTabId[] = browserEntry ? [...openTabs, 'browser'] : openTabs
  const displayedActiveTab = browserEntry?.active ? 'browser' : activeTab

  useEffect(() => {
    useBrowserPanelStore.setState({ currentKey: browserKey })
    return () => {
      if (useBrowserPanelStore.getState().currentKey === browserKey) useBrowserPanelStore.setState({ currentKey: null })
    }
  }, [browserKey])

  useEffect(() => {
    let cancelled = false
    const api = getDesktopApi()
    if (!api) {
      setServerUrl(window.location.origin)
      return
    }
    api
      .getRemoteServer()
      .then(({ url }) => {
        if (!cancelled) setServerUrl(url ?? '')
      })
      .catch(() => {
        if (!cancelled) toast.error('读取浏览器服务配置失败')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const closeTab = useCallback(
    (tabId: WorkPanelTabId) => {
      if (tabId === 'browser') {
        browserClose(browserKey).catch((error: unknown) =>
          toast.error(error instanceof Error ? error.message : '关闭浏览器失败')
        )
        if (!openTabs.length) useChatUiStore.getState().setRightCollapsed(true)
      } else {
        closeWorkPanelTab(tabId)
        if (browserEntry) {
          useChatUiStore.getState().setRightCollapsed(false)
          if (openTabs.length === 1) browserSetActive(browserKey, true)
        }
      }
    },
    [browserClose, browserEntry, browserKey, browserSetActive, closeWorkPanelTab, openTabs.length]
  )

  const selectTab = useCallback(
    (tabId: WorkPanelTabId) => {
      browserSetActive(browserKey, tabId === 'browser')
      if (tabId !== 'browser') setWorkPanelActiveTab(tabId)
    },
    [browserKey, browserSetActive, setWorkPanelActiveTab]
  )

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
      if (tabId === 'browser') {
        browserOpen(browserKey)
        useChatUiStore.getState().setRightCollapsed(false)
        setMenuOpen(false)
        return
      }
      if (openTabs.includes(tabId)) {
        closeTab(tabId)
      } else {
        browserSetActive(browserKey, false)
        openWorkPanelTab(tabId)
      }
      setMenuOpen(false)
    },
    [browserKey, browserOpen, browserSetActive, closeTab, openTabs, openWorkPanelTab]
  )

  const menuItems = useMemo<DropdownItem[]>(() => {
    const toMenuChildren = (tabs: typeof WORKSPACE_MENU_TABS) =>
      tabs.map((tab) => {
        const opened = tab.id === 'browser' ? Boolean(browserEntry) : openTabs.includes(tab.id)
        return {
          icon: <Icon icon={opened ? Check : tab.icon} />,
          disabled: tab.id === 'browser' && !serverUrl,
          key: tab.id,
          label: tab.label,
          onClick: () => handleToggleMenuTab(tab.id),
        }
      })

    return [
      {
        children: toMenuChildren(WORKSPACE_MENU_TABS),
        key: 'workspace',
        label: '工作区',
        type: 'group',
      },
      { type: 'divider' },
      {
        children: toMenuChildren(TOOL_MENU_TABS),
        key: 'tools',
        label: '工具',
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
  }, [browserEntry, handleToggleMenuTab, openTabs, serverUrl])

  const content = useMemo(() => {
    switch (displayedActiveTab) {
      case 'overview':
        return <OverviewContent topic={topic} topicTitle={topicTitle} />
      case 'files':
        return null
      case 'params':
        return <AdvancedSettingsContent value={value} onChange={onChange} />
      default:
        return null
    }
  }, [displayedActiveTab, onChange, topic, topicTitle, value])

  return (
    <FocusScope className={styles.workspace} data-preview-open={previewOpen} data-resizing={isResizing} ref={rootRef}>
      <div className={cx(styles.resizeHandle, styles.panelHandle)} {...separatorProps('panel')} />
      <Flex aria-label='工作面板' className={[styles.panel, 'flex-col']} ref={panelRef}>
        <Flex className={[styles.header, 'items-center gap-1']}>
          <Flex className='no-scrollbar min-w-0 flex-1 items-center gap-1 overflow-x-auto' ref={tabListRef}>
            {displayedTabs.map((tabId) => {
              const meta = WORK_PANEL_TAB_BY_ID[tabId]
              return (
                <WorkPanelTab
                  active={tabId === displayedActiveTab}
                  key={tabId}
                  label={tabId === 'browser' ? browserEntry?.state?.title || meta.label : meta.label}
                  onClose={() => closeTab(tabId)}
                  onSelect={() => selectTab(tabId)}
                />
              )
            })}
            <DropdownMenu items={menuItems} open={menuOpen} placement='bottomLeft' onOpenChange={setMenuOpen}>
              <ActionIcon className={styles.addTrigger} icon={Plus} size='small' title='添加面板' />
            </DropdownMenu>
          </Flex>
          <ActionIcon
            aria-label='折叠工作面板'
            icon={PanelRightClose}
            size='small'
            title='折叠工作面板'
            onClick={toggleRightCollapsed}
          />
        </Flex>
        <Flex className='flex-col flex-1 min-h-0 overflow-hidden'>
          {content}
          {browserEntry ? (
            <div className='h-full min-h-0' hidden={displayedActiveTab !== 'browser'}>
              <BrowserPane
                historyScope={JSON.stringify([serverUrl, userId])}
                instanceId={browserEntry.instanceId}
                agentId={agentId}
                busy={busy}
                contextKey={browserKey}
                key={`${browserKey}:${browserEntry.instanceId}`}
                topicId={topicId}
                visible={displayedActiveTab === 'browser' && !rightCollapsed}
              />
            </div>
          ) : null}
          <div className='h-full min-h-0' hidden={displayedActiveTab !== 'files'}>
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
      {previewOpen ? (
        <div className={cx(styles.resizeHandle, styles.previewHandle)} {...separatorProps('preview')} />
      ) : null}
      <AnimatePresence initial={false}>
        {project && fileTabs.activePath ? (
          <m.div
            animate={{ opacity: 1 }}
            className={styles.previewFrame}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key='file-preview'
            ref={previewRef}
            transition={{ duration: reducedMotion ? 0 : PANEL_ANIMATION_DURATION, ease: PANEL_ANIMATION_EASE }}
          >
            <div className={styles.previewContent}>
              <FilePreview dispatch={dispatchFileTabs} project={project} tabs={fileTabs} />
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </FocusScope>
  )
})

WorkPanelWorkspace.displayName = 'WorkPanelWorkspace'

const WorkPanel = memo<Props>((props) => <WorkPanelWorkspace key={props.topic?.projectName ?? ''} {...props} />)

WorkPanel.displayName = 'WorkPanel'

export default WorkPanel
