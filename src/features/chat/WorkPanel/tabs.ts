import type { LucideIcon } from 'lucide-react'
import {
  Boxes,
  ClipboardList,
  File,
  FileText,
  Globe,
  LayoutDashboard,
  Puzzle,
  Settings2,
} from 'lucide-react'

export type WorkPanelTabId =
  | 'overview'
  | 'params'
  | 'files'
  | 'review'
  | 'artifacts'
  | 'skills'
  | 'docs'
  | 'web'

export type WorkPanelTabSection = 'workspace' | 'config'

export type WorkPanelTabMeta = {
  icon: LucideIcon
  id: WorkPanelTabId
  implemented: boolean
  label: string
  section: WorkPanelTabSection
}

export const WORK_PANEL_TABS: WorkPanelTabMeta[] = [
  { icon: LayoutDashboard, id: 'overview', implemented: true, label: '概览', section: 'workspace' },
  // { icon: ClipboardList, id: 'review', implemented: false, label: '审查', section: 'workspace' },
  { icon: File, id: 'files', implemented: true, label: '文件', section: 'workspace' },
  // { icon: Boxes, id: 'artifacts', implemented: false, label: '产物', section: 'workspace' },
  // { icon: Puzzle, id: 'skills', implemented: false, label: '技能', section: 'workspace' },
  // { icon: FileText, id: 'docs', implemented: false, label: '文档', section: 'workspace' },
  { icon: Globe, id: 'web', implemented: false, label: '网页', section: 'workspace' },
  { icon: Settings2, id: 'params', implemented: true, label: '参数', section: 'config' },
]

export const WORK_PANEL_TAB_BY_ID = Object.fromEntries(WORK_PANEL_TABS.map((tab) => [tab.id, tab])) as Record<
  WorkPanelTabId,
  WorkPanelTabMeta
>

export const DEFAULT_WORK_PANEL_OPEN_TABS: WorkPanelTabId[] = ['overview', 'params']
export const DEFAULT_WORK_PANEL_ACTIVE_TAB: WorkPanelTabId = 'params'

export const WORKSPACE_MENU_TABS = WORK_PANEL_TABS.filter((tab) => tab.section === 'workspace')
export const CONFIG_MENU_TABS = WORK_PANEL_TABS.filter((tab) => tab.section === 'config')

export function isWorkPanelTabId(value: unknown): value is WorkPanelTabId {
  return typeof value === 'string' && value in WORK_PANEL_TAB_BY_ID
}
