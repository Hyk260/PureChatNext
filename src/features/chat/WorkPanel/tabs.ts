import type { LucideIcon } from 'lucide-react'
import { File, Globe, LayoutDashboard, Settings2 } from 'lucide-react'

export type WorkPanelTabId = 'overview' | 'params' | 'files' | 'browser'

export type WorkPanelTabSection = 'workspace' | 'config' | 'tools'

export type WorkPanelTabMeta = {
  icon: LucideIcon
  id: WorkPanelTabId
  label: string
  section: WorkPanelTabSection
}

export const WORK_PANEL_TABS: WorkPanelTabMeta[] = [
  { icon: LayoutDashboard, id: 'overview', label: '概览', section: 'workspace' },
  { icon: File, id: 'files', label: '文件', section: 'workspace' },
  { icon: Globe, id: 'browser', label: '浏览器', section: 'tools' },
  { icon: Settings2, id: 'params', label: '高级设置', section: 'config' },
]

export const WORK_PANEL_TAB_BY_ID = Object.fromEntries(WORK_PANEL_TABS.map((tab) => [tab.id, tab])) as Record<
  WorkPanelTabId,
  WorkPanelTabMeta
>

export const DEFAULT_WORK_PANEL_OPEN_TABS: WorkPanelTabId[] = ['overview', 'params']
export const DEFAULT_WORK_PANEL_ACTIVE_TAB: WorkPanelTabId = 'params'

export const WORKSPACE_MENU_TABS = WORK_PANEL_TABS.filter((tab) => tab.section === 'workspace')
export const CONFIG_MENU_TABS = WORK_PANEL_TABS.filter((tab) => tab.section === 'config')
export const TOOL_MENU_TABS = WORK_PANEL_TABS.filter((tab) => tab.section === 'tools')

export function isWorkPanelTabId(value: unknown): value is WorkPanelTabId {
  return typeof value === 'string' && value in WORK_PANEL_TAB_BY_ID
}
