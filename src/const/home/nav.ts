import type { IconProps } from '@lobehub/ui'
import {
  BookOpen,
  Brain,
  FileText,
  Home,
  Layers,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'

export interface HomeNavItem {
  href?: string
  icon: IconProps['icon']
  key: string
  title: string
}

export const HOME_TOP_NAV: HomeNavItem[] = [
  { href: '#', icon: Search, key: 'search', title: '搜索' },
  { href: '/', icon: Home, key: 'home', title: '首页' },
  // { href: '#', icon: FileText, key: 'tasks', title: '任务' },
  // { href: '#', icon: BookOpen, key: 'documents', title: '文稿' },
]

export const HOME_BOTTOM_NAV: HomeNavItem[] = [
  // { href: '#', icon: Sparkles, key: 'generate', title: '生成' },
  { href: '/community', icon: Users, key: 'community', title: '社区' },
  { href: '/resources', icon: Layers, key: 'resources', title: '资源' },
  // { href: '#', icon: Brain, key: 'memory', title: '记忆' },
]

export interface HomeSidebarSection {
  alwaysVisible?: boolean
  key: string
  title: string
}

export const HOME_SIDEBAR_SECTIONS: HomeSidebarSection[] = [
  { key: 'recents', title: '最近' },
  { alwaysVisible: true, key: 'agents', title: '助理' },
]

export const DEFAULT_SIDEBAR_ITEMS = HOME_SIDEBAR_SECTIONS.map((section) => section.key)

export const SIDEBAR_ACCORDION_KEYS = new Set(['recents', 'agents'])

export const findSidebarSection = (key: string) =>
  HOME_SIDEBAR_SECTIONS.find((section) => section.key === key)
