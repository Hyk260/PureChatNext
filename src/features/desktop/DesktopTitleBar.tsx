'use client'

import { DropdownMenu, Tooltip } from '@pure/ui'
import { createStaticStyles } from 'antd-style'
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  History,
  ListTodo,
  MessageSquare,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Square,
  X,
} from 'lucide-react'
import type { PropsWithChildren } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Outlet, useInRouterContext, useLocation, useNavigate, useNavigationType } from 'react-router'

import { DESKTOP_SIDEBAR_STATE_EVENT, DESKTOP_TOGGLE_SIDEBAR_EVENT } from '@/features/desktop/desktopEvents'
import type { DesktopSidebarStateDetail } from '@/features/desktop/desktopEvents'
import { desktopHref, useDesktopTabsStore } from '@/features/desktop/useDesktopTabsStore'
import { getDesktopApi } from '@/types/desktop'

const styles = createStaticStyles(({ css }) => ({
  root: css`
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
  `,
  bar: css`
    display: flex;
    flex: none;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding-inline: 8px;
    color: var(--ant-color-text, #1f1f1f);
    background: var(--ant-color-bg-layout, #f8f8f8);
    // border-block-end: 1px solid var(--ant-color-border-secondary, #e5e5e5);
    -webkit-app-region: drag;
  `,
  leading: css`
    display: flex;
    flex: none;
    align-items: center;
    gap: 2px;
    height: 100%;
  `,
  trafficLights: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-inline-end: 8px;
    padding-inline: 4px;
    -webkit-app-region: no-drag;
  `,
  trafficLight: css`
    width: 12px;
    height: 12px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    cursor: pointer;
  `,
  closeTrafficLight: css`
    background: #ff5f57;
  `,
  minimizeTrafficLight: css`
    background: #febc2e;
  `,
  maximizeTrafficLight: css`
    background: #28c840;
  `,
  iconButton: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    color: var(--ant-color-text-secondary, #666);
    background: transparent;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    -webkit-app-region: no-drag;

    &:hover:not(:disabled) {
      color: var(--ant-color-text, #1f1f1f);
      background: var(--ant-color-fill-secondary, #f0f0f0);
    }

    &:disabled {
      cursor: default;
      opacity: 0.35;
    }
  `,
  tooltipTarget: css`
    display: inline-flex;
    -webkit-app-region: no-drag;
  `,
  tabs: css`
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
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
    color: var(--ant-color-text-secondary, #666);
    background: transparent;
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    -webkit-app-region: no-drag;

    &:hover {
      color: var(--ant-color-text, #1f1f1f);
      background: var(--ant-color-fill-tertiary, #f5f5f5);
    }

    &:hover .desktop-tab-close,
    &.active .desktop-tab-close {
      opacity: 1;
    }
  `,
  tabActive: css`
    color: var(--ant-color-text, #1f1f1f);
    background: var(--ant-color-bg-container, #fff);
    box-shadow: 0 0 0 1px var(--ant-color-border-secondary, #e5e5e5);

    &:hover {
      background: var(--ant-color-bg-container, #fff);
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
    color: var(--ant-color-text-tertiary, #999);
    background: transparent;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
    opacity: 0;

    &:hover {
      color: var(--ant-color-text, #1f1f1f);
      background: var(--ant-color-fill-secondary, #f0f0f0);
    }
  `,
  addTab: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    color: var(--ant-color-text-secondary, #666);
    background: transparent;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    -webkit-app-region: no-drag;

    &:hover {
      color: var(--ant-color-text, #1f1f1f);
      background: var(--ant-color-fill-secondary, #f0f0f0);
    }
  `,
  controls: css`
    display: flex;
    height: 100%;
    -webkit-app-region: no-drag;
  `,
  button: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 100%;
    padding: 0;
    color: var(--ant-color-text-secondary, #666);
    background: transparent;
    border: 0;
    cursor: pointer;

    &:hover {
      color: var(--ant-color-text, #1f1f1f);
      background: var(--ant-color-fill-secondary, #f0f0f0);
    }
  `,
  closeButton: css`
    &:hover {
      color: #fff;
      background: #e81123;
    }
  `,
  content: css`
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
  `,
}))

function tabIconForPath(path: string) {
  if (path.startsWith('/resources') || path.startsWith('/community')) return ListTodo
  return MessageSquare
}

type ChromeProps = {
  canGoBack: boolean
  canGoForward: boolean
  historyMenuItems: Array<{ key: string; label: string; onClick: () => void }>
  isMaximized: boolean
  isSidebarCollapsed: boolean
  onActivateTab: (id: string) => void
  onAddTab: () => void
  onBack: () => void
  onCloseTab: (id: string) => void
  onForward: () => void
  onToggleMaximize: () => void
  onToggleSidebar: () => void
  platform: NodeJS.Platform | null
}

const DesktopTitleBarChrome = ({
  canGoBack,
  canGoForward,
  historyMenuItems,
  isMaximized,
  isSidebarCollapsed,
  onActivateTab,
  onAddTab,
  onBack,
  onCloseTab,
  onForward,
  onToggleMaximize,
  onToggleSidebar,
  platform,
}: ChromeProps) => {
  const api = getDesktopApi()
  const tabs = useDesktopTabsStore((s) => s.tabs)
  const activeTabId = useDesktopTabsStore((s) => s.activeTabId)

  if (!api) return null

  const isMac = platform === 'darwin'
  const sidebarLabel = isSidebarCollapsed ? '展开侧栏' : '折叠侧栏'

  return (
    <header className={styles.bar}>
      <div className={styles.leading}>
        {isMac ? (
          <div className={styles.trafficLights}>
            <button
              aria-label='关闭窗口'
              className={`${styles.trafficLight} ${styles.closeTrafficLight}`}
              onClick={() => void api.closeWindow()}
              type='button'
            />
            <button
              aria-label='最小化窗口'
              className={`${styles.trafficLight} ${styles.minimizeTrafficLight}`}
              onClick={() => void api.minimizeWindow()}
              type='button'
            />
            <button
              aria-label={isMaximized ? '还原窗口' : '最大化窗口'}
              className={`${styles.trafficLight} ${styles.maximizeTrafficLight}`}
              onClick={onToggleMaximize}
              type='button'
            />
          </div>
        ) : null}

        <Tooltip title={sidebarLabel}>
          <span className={styles.tooltipTarget}>
            <button
              aria-label={sidebarLabel}
              className={styles.iconButton}
              onClick={onToggleSidebar}
              type='button'
            >
              {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </span>
        </Tooltip>

        <Tooltip title='后退'>
          <span className={styles.tooltipTarget}>
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
          <span className={styles.tooltipTarget}>
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

        <Tooltip title='显示历史记录'>
          <span className={styles.tooltipTarget}>
            <DropdownMenu items={historyMenuItems} nativeButton placement='bottomLeft'>
              <button aria-label='显示历史记录' className={styles.iconButton} type='button'>
                <History size={16} />
              </button>
            </DropdownMenu>
          </span>
        </Tooltip>
      </div>

      <div className={styles.tabs}>
        {tabs.map((tab) => {
          const active = tab.id === activeTabId
          const Icon = tabIconForPath(tab.path)
          return (
            <div
              className={`${styles.tab} ${active ? `${styles.tabActive} active` : ''}`}
              key={tab.id}
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
              <span className={styles.tabIcon}>
                <Icon size={14} />
              </span>
              <span className={styles.tabTitle}>{tab.title}</span>
              <button
                aria-label={`关闭 ${tab.title}`}
                className={`desktop-tab-close ${styles.tabClose}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onCloseTab(tab.id)
                }}
                type='button'
              >
                <X size={12} />
              </button>
            </div>
          )
        })}
        <button aria-label='新建选项卡' className={styles.addTab} onClick={onAddTab} type='button'>
          <Plus size={16} />
        </button>
      </div>

      {platform && !isMac ? (
        <div className={styles.controls}>
          <button
            aria-label='最小化窗口'
            className={styles.button}
            onClick={() => void api.minimizeWindow()}
            type='button'
          >
            <Minus size={14} />
          </button>
          <button
            aria-label={isMaximized ? '还原窗口' : '最大化窗口'}
            className={styles.button}
            onClick={onToggleMaximize}
            type='button'
          >
            {isMaximized ? <Copy size={13} /> : <Square size={13} />}
          </button>
          <button
            aria-label='关闭窗口'
            className={`${styles.button} ${styles.closeButton}`}
            onClick={() => void api.closeWindow()}
            type='button'
          >
            <X size={15} />
          </button>
        </div>
      ) : null}
    </header>
  )
}

function useWindowChromeState() {
  const api = getDesktopApi()
  const [isMaximized, setIsMaximized] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [platform, setPlatform] = useState<NodeJS.Platform | null>(null)

  useEffect(() => {
    if (!api) return
    let active = true
    void Promise.all([api.getAppInfo(), api.getWindowState()]).then(([appInfo, state]) => {
      if (!active) return
      setPlatform(appInfo.platform)
      setIsMaximized(state.isMaximized)
    })
    return () => {
      active = false
    }
  }, [api])

  useEffect(() => {
    const handleSidebarState = (event: Event) => {
      const detail = (event as CustomEvent<DesktopSidebarStateDetail>).detail
      if (detail) setIsSidebarCollapsed(detail.collapsed)
    }
    window.addEventListener(DESKTOP_SIDEBAR_STATE_EVENT, handleSidebarState)
    return () => window.removeEventListener(DESKTOP_SIDEBAR_STATE_EVENT, handleSidebarState)
  }, [])

  const handleToggleMaximize = async () => {
    if (!api) return
    const state = await api.toggleMaximizeWindow()
    setIsMaximized(state.isMaximized)
  }

  return {
    isMaximized,
    isSidebarCollapsed,
    platform,
    toggleMaximize: () => void handleToggleMaximize(),
    toggleSidebar: () => window.dispatchEvent(new Event(DESKTOP_TOGGLE_SIDEBAR_EVENT)),
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
  const addTab = useDesktopTabsStore((s) => s.addTab)
  const closeTab = useDesktopTabsStore((s) => s.closeTab)
  const activateTab = useDesktopTabsStore((s) => s.activateTab)
  const syncLocation = useDesktopTabsStore((s) => s.syncLocation)
  const markBack = useDesktopTabsStore((s) => s.markBack)
  const markForward = useDesktopTabsStore((s) => s.markForward)

  useEffect(() => {
    syncLocation(location.pathname, location.search, navigationType)
  }, [location.pathname, location.search, location.key, navigationType, syncLocation])

  const historyMenuItems = useMemo(
    () =>
      historyEntries.map((entry) => ({
        key: entry.id,
        label: entry.title,
        onClick: () => navigate(desktopHref(entry)),
      })),
    [historyEntries, navigate]
  )

  return (
    <DesktopTitleBarChrome
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      historyMenuItems={historyMenuItems}
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
