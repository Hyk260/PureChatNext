'use client'

import { Accordion, Flexbox } from '@lobehub/ui'
import { App } from 'antd'
import { memo, useCallback, useMemo, type Key, type ReactElement } from 'react'

import NavItem from '@/components/NavItem'
import {
  findSidebarSection,
  SIDEBAR_ACCORDION_KEYS,
  SIDEBAR_SPACER_ID,
} from '@/const/home/nav'
import AgentSection from '@/features/home/HomeSidebar/sections/AgentSection'
import RecentsSection from '@/features/home/HomeSidebar/sections/RecentsSection'
import { pickAccordionExpandedKeys } from '@/features/home/store/sidebarDefaults'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import Link from '@/utils/link'
import { usePathname } from '@/utils/navigation'

const sectionComponents = {
  agents: AgentSection,
  recents: RecentsSection,
} as const

const SidebarBody = memo(() => {
  const pathname = usePathname()
  const { message } = App.useApp()
  const hiddenSidebarSections = useHomeStore((s) => s.hiddenSidebarSections)
  const sidebarExpandedKeys = useHomeStore((s) => s.sidebarExpandedKeys)
  const sidebarItems = useHomeStore((s) => s.sidebarItems)
  const setSidebarAccordionExpandedKeys = useHomeStore((s) => s.setSidebarAccordionExpandedKeys)

  const visibleKeys = useMemo(
    () =>
      sidebarItems.filter(
        (key) =>
          key === SIDEBAR_SPACER_ID ||
          key === 'agents' ||
          !hiddenSidebarSections.includes(key),
      ),
    [hiddenSidebarSections, sidebarItems],
  )

  const handleAccordionExpandedChange = useCallback(
    (accordionKeys: string[], expandedKeys: Key[]) => {
      setSidebarAccordionExpandedKeys(accordionKeys, expandedKeys.map(String))
    },
    [setSidebarAccordionExpandedKeys],
  )

  const renderNavLink = useCallback(
    (key: string) => {
      const section = findSidebarSection(key)
      if (!section) return null

      if (!section.href || section.href === '#') {
        return (
          <NavItem
            key={key}
            icon={section.icon}
            title={section.title}
            onItemClick={() => message.info('功能即将推出')}
          />
        )
      }

      const active = pathname.startsWith(section.href)
      return (
        <Link key={key} href={section.href} style={{ color: 'inherit', textDecoration: 'none' }}>
          <NavItem active={active} clickable icon={section.icon} title={section.title} />
        </Link>
      )
    },
    [message, pathname],
  )

  const content = useMemo(() => {
    const elements: ReactElement[] = []
    let accGroup: { element: ReactElement; key: string }[] = []

    const flushAccordion = () => {
      if (accGroup.length === 0) return

      const accordionKeys = accGroup.map((item) => item.key)
      const expandedKeys = pickAccordionExpandedKeys(sidebarExpandedKeys, accordionKeys)

      elements.push(
        <Accordion
          expandedKeys={expandedKeys}
          gap={8}
          key={`acc-${elements.length}`}
          onExpandedChange={(keys) => handleAccordionExpandedChange(accordionKeys, keys)}
        >
          {accGroup.map((item) => item.element)}
        </Accordion>,
      )
      accGroup = []
    }

    for (const key of visibleKeys) {
      if (key === SIDEBAR_SPACER_ID) {
        flushAccordion()
        elements.push(
          <div
            aria-hidden
            data-sidebar-bottom-spacer
            key={`spacer-${elements.length}`}
            style={{ flex: '1 1 0', minHeight: 0 }}
          />,
        )
        continue
      }

      if (SIDEBAR_ACCORDION_KEYS.has(key)) {
        const Section = sectionComponents[key as keyof typeof sectionComponents]
        if (Section) {
          accGroup.push({ element: <Section itemKey={key} key={key} />, key })
        }
        continue
      }

      flushAccordion()
      const link = renderNavLink(key)
      if (link) elements.push(link)
    }

    flushAccordion()
    return elements
  }, [handleAccordionExpandedChange, renderNavLink, sidebarExpandedKeys, visibleKeys])

  if (content.length === 0) return null

  return (
    <Flexbox flex={1} gap={1} paddingInline={4} style={{ minHeight: 0 }}>
      {content}
    </Flexbox>
  )
})

SidebarBody.displayName = 'SidebarBody'

export default SidebarBody
