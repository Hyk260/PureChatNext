import type { IconProps } from '@pure/ui'
import { Home, Layers, Search, Users } from 'lucide-react'

import { isDev } from '@/libs/constants'

export interface HomeNavItem {
  href?: string
  icon: IconProps['icon']
  key: string
  title: string
}

export const HOME_TOP_NAV: HomeNavItem[] = [
  { href: '#', icon: Search, key: 'search', title: '搜索' },
  { href: '/', icon: Home, key: 'home', title: '首页' },
]

/** Sentinel id for the flex spacer; position decides which items pin to bottom. */
export const SIDEBAR_SPACER_ID = '__spacer__'

export interface HomeSidebarSection {
  alwaysVisible?: boolean
  href?: string
  icon?: IconProps['icon']
  key: string
  title: string
}

/** Dev-only until resources ships. */
const RESOURCES_SECTION: HomeSidebarSection = {
  href: '/resources',
  icon: Layers,
  key: 'resources',
  title: '资源',
}

export const HOME_SIDEBAR_SECTIONS: HomeSidebarSection[] = [
  { key: 'recents', title: '最近' },
  { alwaysVisible: true, key: 'agents', title: '助理' },
  { href: '/community', icon: Users, key: 'community', title: '社区' },
  ...(isDev ? [RESOURCES_SECTION] : []),
]

export const DEFAULT_SIDEBAR_ITEMS: string[] = [
  'recents',
  'agents',
  SIDEBAR_SPACER_ID,
  'community',
  ...(isDev ? ['resources'] : []),
]

export const SIDEBAR_ACCORDION_KEYS = new Set(['recents', 'agents'])

const DEFAULT_BOTTOM_KEYS = new Set(DEFAULT_SIDEBAR_ITEMS.slice(DEFAULT_SIDEBAR_ITEMS.indexOf(SIDEBAR_SPACER_ID) + 1))

export const findSidebarSection = (key: string) => HOME_SIDEBAR_SECTIONS.find((section) => section.key === key)

/** Keep spacer immediately after the accordion block; backfill missing defaults. */
export const normalizeSidebarItems = (order: string[]): string[] => {
  const knownIds = new Set([...HOME_SIDEBAR_SECTIONS.map((s) => s.key), SIDEBAR_SPACER_ID])
  const withoutUnknown = order.filter((id) => knownIds.has(id))
  const withoutSpacer = withoutUnknown.filter((id) => id !== SIDEBAR_SPACER_ID)

  const present = new Set(withoutSpacer)
  const missingTop: string[] = []
  const missingBottom: string[] = []

  for (const id of DEFAULT_SIDEBAR_ITEMS) {
    if (id === SIDEBAR_SPACER_ID || present.has(id)) continue
    ;(DEFAULT_BOTTOM_KEYS.has(id) ? missingBottom : missingTop).push(id)
  }

  let insertAt = -1
  for (let i = withoutSpacer.length - 1; i >= 0; i--) {
    if (SIDEBAR_ACCORDION_KEYS.has(withoutSpacer[i])) {
      insertAt = i + 1
      break
    }
  }
  if (insertAt === -1) {
    const bottomIdx = withoutSpacer.findIndex((id) => DEFAULT_BOTTOM_KEYS.has(id))
    insertAt = bottomIdx === -1 ? withoutSpacer.length : bottomIdx
  }

  const withSpacer = [...withoutSpacer.slice(0, insertAt), SIDEBAR_SPACER_ID, ...withoutSpacer.slice(insertAt)]

  if (missingTop.length === 0 && missingBottom.length === 0) return withSpacer

  const spacerIdx = withSpacer.indexOf(SIDEBAR_SPACER_ID)
  let accordionStartIdx = spacerIdx
  for (let i = 0; i < spacerIdx; i++) {
    if (SIDEBAR_ACCORDION_KEYS.has(withSpacer[i])) {
      accordionStartIdx = i
      break
    }
  }

  return [
    ...withSpacer.slice(0, accordionStartIdx),
    ...missingTop,
    ...withSpacer.slice(accordionStartIdx, spacerIdx + 1),
    ...missingBottom,
    ...withSpacer.slice(spacerIdx + 1),
  ]
}
