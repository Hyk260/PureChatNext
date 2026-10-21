'use client'

import { ActionIcon, DropdownMenu, Tooltip } from '@pure/ui'
import { Divider, createStaticStyles, cx } from '@lobehub/ui'
import {
  ArrowLeft,
  ArrowRight,
  CircleFadingArrowUp,
  History,
  Home,
  ListTodo,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  Plus,
  X,
} from 'lucide-react'
import type { ComponentProps, PropsWithChildren } from 'react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Outlet, useInRouterContext, useLocation, useNavigate, useNavigationType } from 'react-router'

import DesktopWindowControls from '@/features/desktop/DesktopWindowControls'
import MacTrafficLights from '@/features/desktop/MacTrafficLights'
import {
  desktopHref,
  useDesktopPinnedHistoryStore,
  useDesktopTabsStore,
} from '@/features/desktop/useDesktopTabsStore'
import { useDesktopUpdateVersion } from '@/features/desktop/useDesktopUpdateVersion'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { DEFAULT_SIDEBAR_WIDTH, SIDEBAR_TRANSITION, useSidebarLayoutStore } from '@/layout/sidebarResize'
import { getDesktopApi } from '@/types/desktop'

type HistoryEntry = ReturnType<typeof useDesktopTabsStore.getState>['historyEntries'][number]
type PinnedHistoryEntry = ReturnType<typeof useDesktopPinnedHistoryStore.getState>['entries'][number]
type HistoryMenuItem = Extract<NonNullable<ComponentProps<typeof DropdownMenu>['items']>, unknown[]>[number]

const styles = createStaticStyles(({ css }) => ({
  root: css`
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  `,
  bar: css`
    display: flex;
    flex: none;
    align-items: center;
    height: 38px;
    color: var(--lobe-color-text, #1f1f1f);
    background: var(--lobe-color-bg-layout, #f8f8f8);
    -webkit-app-region: drag;
  `,
  leading: css`
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    height: 100%;
    padding-inline: 8px;
    transition: width ${SIDEBAR_TRANSITION};

    &[data-resizing='true'] {
      transition: none;
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `,
  leadingStart: css`
    display: flex;
    flex: none;
    align-items: center;
    gap: 2px;
    height: 100%;
  `,
  leadingEnd: css`
    display: flex;
    flex: none;
    align-items: center;
    gap: 2px;
    height: 100%;
  `,
  iconButton: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    color: var(--lobe-color-text-secondary, #666);
    background: transparent;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    -webkit-app-region: no-drag;

    &:hover:not(:disabled) {
      color: var(--lobe-color-text, #1f1f1f);
      background: var(--lobe-color-fill-secondary, #f0f0f0);
    }

    &:disabled {
      cursor: default;
      opacity: 0.35;
    }
  `,
  // 保留 createStaticStyles：依赖 Electron 窗口拖拽区域属性。
  tooltipTarget: css`
    -webkit-app-region: no-drag;
  `,
  main: css`
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
    height: 100%;
    padding: 0 8px 0 0;
  `,
  tabs: css`
    display: flex;
    flex: 1;
    align-items: center;
    gap: 4px;
    min-width: 0;
    height: 100%;
  `,
  tab: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 220px;
    height: 28px;
    padding: 0 8px 0 10px;
    overflow: hidden;
    color: var(--lobe-color-text-secondary, #666);
    background: transparent;
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    -webkit-app-region: no-drag;

    &:hover {
      color: var(--lobe-color-text, #1f1f1f);
      background: var(--lobe-color-fill-tertiary, #f5f5f5);
    }

    &:hover .desktop-tab-close,
    &.active .desktop-tab-close {
      opacity: 1;
    }
  `,
  tabActive: css`
    color: var(--lobe-color-text, #1f1f1f);
    background: var(--lobe-color-bg-container, #fff);
    box-shadow: 0 0 0 1px var(--lobe-color-border-secondary, #e5e5e5);

    &:hover {
      background: var(--lobe-color-bg-container, #fff);
    }
  `,
  tabIcon: css`
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
  `,
  tabTitle: css`
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  `,
  tabClose: css`
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    color: var(--lobe-color-text-tertiary, #999);
    background: transparent;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
    opacity: 0;

    &:hover {
      color: var(--lobe-color-text, #1f1f1f);
      background: var(--lobe-color-fill-secondary, #f0f0f0);
    }

    &:disabled {
      cursor: default;
      opacity: 0.35;
    }
  `,
  addTab: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    min-width: 28px;
    min-height: 28px;
    padding: 0;
    color: var(--lobe-color-text-secondary, #666);
    background: transparent;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    -webkit-app-region: no-drag;

    &:hover {
      color: var(--lobe-color-text, #1f1f1f);
      background: var(--lobe-color-fill-secondary, #f0f0f0);
    }
  `,
  content: css`
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    flex-direction: column;
  `,
}))

function tabIconForPath(path: string) {
  if (path === '/') return Home
  if (path.startsWith('/resources') || path.startsWith('/community')) return ListTodo
  return MessageSquare
}

function toHistoryMenuItem(
  entry: HistoryEntry | PinnedHistoryEntry,
  pinned: boolean,
  onOpen: () => void,
  onTogglePin: () => void
): HistoryMenuItem {
  return {
    extra: (
      <button
        aria-label={pinned ? `取消置顶 ${entry.title}` : `置顶 ${entry.title}`}
        className='flex-center size-7 shrink-0 rounded-md border-0 p-0 text-muted-foreground hover:bg-secondary'
        title={pinned ? '取消置顶' : '置顶'}
        type='button'
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onTogglePin()
        }}
      >
        {pinned ? <PinOff size={14} /> : <Pin size={14} />}
      </button>
    ),
    icon: tabIconForPath(entry.path),
    key: `${pinned ? 'pinned' : 'recent'}:${desktopHref(entry)}`,
    label: entry.title,
    onClick: onOpen,
  }
}

type ChromeProps = {
  canGoBack: boolean
  canGoForward: boolean
  hideNavigation?: boolean
  historyMenuItems: HistoryMenuItem[]
  isMaximized: boolean
  isSidebarCollapsed: boolean
  onActivateTab: (id: string) => void
  onAddTab: () => void
  onBack: () => void
  onCloseTab: (id: string) => void
  onForward: () => void
  onOpenUpdate?: () => void
  onToggleMaximize: () => void
  onToggleSidebar: () => void
  platform: NodeJS.Platform | null
}

const DesktopTitleBarChrome = ({
  canGoBack,
  canGoForward,
  historyMenuItems,
  hideNavigation = false,
  isMaximized,
  isSidebarCollapsed,
  onActivateTab,
  onAddTab,
  onBack,
  onCloseTab,
  onForward,
  onOpenUpdate,
  onToggleMaximize,
  onToggleSidebar,
  platform,
}: ChromeProps) => {
  const api = getDesktopApi()
  const tabs = useDesktopTabsStore((s) => s.tabs)
  const activeTabId = useDesktopTabsStore((s) => s.activeTabId)
  const sidebarWidth = useSidebarLayoutStore((s) => s.sidebarWidth)
  const isResizing = useSidebarLayoutStore((s) => s.isResizing)
  const updateVersion = useDesktopUpdateVersion()

  if (!api) return null

  const isMac = platform === 'darwin'
  if (hideNavigation) {
    return (
      <header className={styles.bar}>
        <div className={styles.leading}>
          {isMac ? (
            <MacTrafficLights
              isMaximized={isMaximized}
              onClose={api.closeWindow}
              onMaximize={onToggleMaximize}
              onMinimize={api.minimizeWindow}
            />
          ) : null}
        </div>
        <div className='flex-1' />
        {platform && !isMac ? (
          <DesktopWindowControls
            isMaximized={isMaximized}
            onClose={api.closeWindow}
            onMinimize={api.minimizeWindow}
            onToggleMaximize={onToggleMaximize}
          />
        ) : null}
      </header>
    )
  }

  const sidebarLabel = isSidebarCollapsed ? '展开侧栏' : '折叠侧栏'
  // Controls, gaps and padding must fit even when the sidebar is hidden.
  const collapsedLeadingWidth = isMac ? 212 : 136
  const leadingWidth = isSidebarCollapsed ? collapsedLeadingWidth : sidebarWidth || DEFAULT_SIDEBAR_WIDTH

  return (
    <header className={styles.bar}>
      <div className={styles.leading} data-resizing={isResizing} style={{ width: leadingWidth }}>
        <div className={styles.leadingStart}>
          {isMac ? (
            <MacTrafficLights
              isMaximized={isMaximized}
              onClose={api.closeWindow}
              onMaximize={onToggleMaximize}
              onMinimize={api.minimizeWindow}
            />
          ) : null}

          <Tooltip title={sidebarLabel}>
            <span className={cx(styles.tooltipTarget, 'inline-flex')}>
              <button
                aria-expanded={!isSidebarCollapsed}
                aria-label={sidebarLabel}
                className={styles.iconButton}
                onClick={onToggleSidebar}
                type='button'
              >
                {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              </button>
            </span>
          </Tooltip>
        </div>

        <div className={styles.leadingEnd}>
          <Tooltip title='后退'>
            <span className={cx(styles.tooltipTarget, 'inline-flex')}>
              <button
                aria-label='后退'
                className={styles.iconButton}
                disabled={!canGoBack}
                onClick={onBack}
                type='button'
              >
                <ArrowLeft size={16} />
              </button>
            </span>
          </Tooltip>

          <Tooltip title='前进'>
            <span className={cx(styles.tooltipTarget, 'inline-flex')}>
              <button
                aria-label='前进'
                className={styles.iconButton}
                disabled={!canGoForward}
                onClick={onForward}
                type='button'
              >
                <ArrowRight size={16} />
              </button>
            </span>
          </Tooltip>

          <Tooltip title='历史记录'>
            <span className={cx(styles.tooltipTarget, 'inline-flex')}>
              <DropdownMenu items={historyMenuItems} nativeButton placement='bottomLeft'>
                <button aria-label='历史记录' className={styles.iconButton} type='button'>
                  <History size={16} />
                </button>
              </DropdownMenu>
            </span>
          </Tooltip>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.tabs}>
          {tabs.map((tab, index) => {
            const active = tab.id === activeTabId
            const Icon = tabIconForPath(tab.path)
            return (
              <Fragment key={tab.id}>
                {index > 0 ? <Divider orientation='vertical' /> : null}
                <div
                  className={`${styles.tab} ${active ? `${styles.tabActive} active` : ''}`}
                  role='tab'
                  tabIndex={0}
                  onClick={() => onActivateTab(tab.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onActivateTab(tab.id)
                    }
                  }}
                >
                  {/* <span className={styles.tabIcon}>
                    <Icon size={14} />
                  </span> */}
                  <span className={styles.tabTitle}>{tab.title}</span>
                  <button
                    aria-label={`关闭 ${tab.title}`}
                    className={`desktop-tab-close ${styles.tabClose}`}
                    disabled={tabs.length <= 1}
                    onClick={(event) => {
                      event.stopPropagation()
                      onCloseTab(tab.id)
                    }}
                    type='button'
                  >
                    <X size={12} />
                  </button>
                </div>
              </Fragment>
            )
          })}
          <button aria-label='新建选项卡' className={styles.addTab} onClick={onAddTab} type='button'>
            <Plus size={16} />
          </button>
        </div>

        {updateVersion && onOpenUpdate ? (
          <ActionIcon
            aria-label='查看更新'
            className='shrink-0 text-green! [-webkit-app-region:no-drag]'
            icon={CircleFadingArrowUp}
            size={{ blockSize: 28, size: 18 }}
            title={`更新 v${updateVersion}`}
            onClick={onOpenUpdate}
          />
        ) : null}

        {platform && !isMac ? (
          <DesktopWindowControls
            isMaximized={isMaximized}
            onClose={api.closeWindow}
            onMinimize={api.minimizeWindow}
            onToggleMaximize={onToggleMaximize}
          />
        ) : null}
      </div>
    </header>
  )
}

function useWindowChromeState() {
  const api = getDesktopApi()
  const [isMaximized, setIsMaximized] = useState(false)
  const isSidebarCollapsed = useHomeStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useHomeStore((state) => state.toggleSidebarCollapsed)
  const [platform, setPlatform] = useState<NodeJS.Platform | null>(null)

  useEffect(() => {
    if (!api) return
    let active = true
    Promise.all([api.getAppInfo(), api.getWindowState()]).then(([appInfo, state]) => {
      if (!active) return
      setPlatform(appInfo.platform)
      setIsMaximized(state.isMaximized)
    })
    return () => {
      active = false
    }
  }, [api])

  const handleToggleMaximize = async () => {
    if (!api) return
    const state = await api.toggleMaximizeWindow()
    setIsMaximized(state.isMaximized)
  }

  return {
    isMaximized,
    isSidebarCollapsed,
    platform,
    toggleMaximize: handleToggleMaximize,
    toggleSidebar,
  }
}

/** Route-aware chrome: back/forward, history menu, tab sync. */
const DesktopTitleBarNav = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const navigationType = useNavigationType()
  const chrome = useWindowChromeState()

  const canGoBack = useDesktopTabsStore((s) => s.canGoBack)
  const canGoForward = useDesktopTabsStore((s) => s.canGoForward)
  const historyEntries = useDesktopTabsStore((s) => s.historyEntries)
  const pinnedHistoryEntries = useDesktopPinnedHistoryStore((s) => s.entries)
  const togglePinnedHistoryEntry = useDesktopPinnedHistoryStore((s) => s.toggle)
  const addTab = useDesktopTabsStore((s) => s.addTab)
  const closeTab = useDesktopTabsStore((s) => s.closeTab)
  const activateTab = useDesktopTabsStore((s) => s.activateTab)
  const openHistoryEntry = useDesktopTabsStore((s) => s.openHistoryEntry)
  const syncLocation = useDesktopTabsStore((s) => s.syncLocation)
  const markBack = useDesktopTabsStore((s) => s.markBack)
  const markForward = useDesktopTabsStore((s) => s.markForward)

  useEffect(() => {
    syncLocation(location.pathname, location.search, navigationType)
  }, [location.pathname, location.search, location.key, navigationType, syncLocation])

  const historyMenuItems = useMemo<HistoryMenuItem[]>(() => {
    const pinnedHrefs = new Set(pinnedHistoryEntries.map(desktopHref))
    const recentEntries = historyEntries.filter((entry) => !pinnedHrefs.has(desktopHref(entry)))
    const items: HistoryMenuItem[] = []

    if (pinnedHistoryEntries.length > 0) {
      items.push({
        children: [...pinnedHistoryEntries]
          .sort((a, b) => b.pinnedAt - a.pinnedAt)
          .map((entry) =>
            toHistoryMenuItem(entry, true, () => {
              const tab = openHistoryEntry(entry)
              navigate(desktopHref(tab))
            }, () => togglePinnedHistoryEntry(entry))
          ),
        key: 'pinned-history',
        label: '已固定',
        type: 'group',
      })
    }

    if (recentEntries.length > 0) {
      items.push({
        children: recentEntries.map((entry) =>
          toHistoryMenuItem(entry, false, () => {
            const tab = openHistoryEntry(entry)
            navigate(desktopHref(tab))
          }, () => togglePinnedHistoryEntry(entry))
        ),
        key: 'recent-history',
        label: '最近访问',
        type: 'group',
      })
    }

    if (items.length === 0) items.push({ disabled: true, key: 'empty-history', label: '暂无访问记录' })
    return items
  }, [historyEntries, navigate, openHistoryEntry, pinnedHistoryEntries, togglePinnedHistoryEntry])

  return (
    <DesktopTitleBarChrome
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      historyMenuItems={historyMenuItems}
      hideNavigation={location.pathname === '/desktop-login' || location.pathname === '/desktop-login/'}
      isMaximized={chrome.isMaximized}
      isSidebarCollapsed={chrome.isSidebarCollapsed}
      platform={chrome.platform}
      onActivateTab={(id) => {
        const tab = activateTab(id)
        if (tab) navigate(desktopHref(tab))
      }}
      onAddTab={() => {
        const tab = addTab('/')
        navigate(desktopHref(tab))
      }}
      onBack={() => {
        if (!canGoBack) return
        markBack()
        navigate(-1)
      }}
      onCloseTab={(id) => {
        const { closedActive, next } = closeTab(id)
        if (closedActive && next) navigate(desktopHref(next))
      }}
      onForward={() => {
        if (!canGoForward) return
        markForward()
        navigate(1)
      }}
      onOpenUpdate={() => navigate('/settings/about?update=install')}
      onToggleMaximize={chrome.toggleMaximize}
      onToggleSidebar={chrome.toggleSidebar}
    />
  )
}

/** Setup / offline chrome without router hooks. */
const DesktopTitleBarStatic = () => {
  const chrome = useWindowChromeState()

  return (
    <DesktopTitleBarChrome
      canGoBack={false}
      canGoForward={false}
      historyMenuItems={[]}
      hideNavigation
      isMaximized={chrome.isMaximized}
      isSidebarCollapsed={chrome.isSidebarCollapsed}
      platform={chrome.platform}
      onActivateTab={() => undefined}
      onAddTab={() => undefined}
      onBack={() => undefined}
      onCloseTab={() => undefined}
      onForward={() => undefined}
      onToggleMaximize={chrome.toggleMaximize}
      onToggleSidebar={chrome.toggleSidebar}
    />
  )
}

const DesktopTitleBar = ({ children }: PropsWithChildren) => {
  const api = getDesktopApi()
  const inRouter = useInRouterContext()

  if (!api) return children

  return (
    <div className={styles.root}>
      {inRouter ? <DesktopTitleBarNav /> : <DesktopTitleBarStatic />}
      <div className={styles.content}>{children}</div>
    </div>
  )
}

/** Desktop route shell — place above `webRoutes` so the title bar is inside the router. */
export function DesktopTitleBarLayout() {
  return (
    <DesktopTitleBar>
      <Outlet />
    </DesktopTitleBar>
  )
}

export default DesktopTitleBar
