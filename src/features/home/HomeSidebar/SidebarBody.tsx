'use client'

import { Accordion } from '@pure/ui'
import { Flex } from 'antd'
import { useApp } from '@/components/AntdStaticMethods'
import Scrollbar from '@/components/Scrollbar'
import { memo, useCallback, useMemo, type Key, type ReactElement } from 'react'

import NavItem from '@/components/NavItem'
import { findSidebarSection, SIDEBAR_ACCORDION_KEYS, SIDEBAR_SPACER_ID } from '@/const/home/nav'
import AgentSection from '@/features/home/HomeSidebar/sections/AgentSection'
import RecentsSection from '@/features/home/HomeSidebar/sections/RecentsSection'
import { pickAccordionExpandedKeys } from '@/features/home/store/sidebarDefaults'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import Link from '@/utils/link'
import { usePathname } from '@/utils/navigation'

const sectionComponents = {
  agents: AgentSection,
  // recents: RecentsSection,
} as const

const SidebarBody = memo(() => {
  const pathname = usePathname()
  const { message } = useApp()
  const hiddenSidebarSections = useHomeStore((s) => s.hiddenSidebarSections)
  const sidebarExpandedKeys = useHomeStore((s) => s.sidebarExpandedKeys)
  const sidebarItems = useHomeStore((s) => s.sidebarItems)
  const setSidebarAccordionExpandedKeys = useHomeStore((s) => s.setSidebarAccordionExpandedKeys)

  const visibleKeys = useMemo(
    () =>
      sidebarItems.filter(
        (key) => key === SIDEBAR_SPACER_ID || key === 'agents' || !hiddenSidebarSections.includes(key)
      ),
    [hiddenSidebarSections, sidebarItems]
  )

  const handleAccordionExpandedChange = useCallback(
    (accordionKeys: string[], expandedKeys: Key[]) => {
      setSidebarAccordionExpandedKeys(accordionKeys, expandedKeys.map(String))
    },
    [setSidebarAccordionExpandedKeys]
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
    [message, pathname]
  )

  const buildContent = useCallback(
    (keys: string[]): ReactElement[] => {
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
          </Accordion>
        )
        accGroup = []
      }

      for (const key of keys) {
        if (key === SIDEBAR_SPACER_ID) continue

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
    },
    [handleAccordionExpandedChange, renderNavLink, sidebarExpandedKeys]
  )

  const topKeys = useMemo(() => {
    const idx = visibleKeys.indexOf(SIDEBAR_SPACER_ID)
    return idx === -1 ? visibleKeys : visibleKeys.slice(0, idx)
  }, [visibleKeys])
  const bottomKeys = useMemo(() => {
    const idx = visibleKeys.indexOf(SIDEBAR_SPACER_ID)
    return idx === -1 ? [] : visibleKeys.slice(idx + 1)
  }, [visibleKeys])

  const topContent = useMemo(() => buildContent(topKeys), [buildContent, topKeys])
  const bottomContent = useMemo(() => buildContent(bottomKeys), [buildContent, bottomKeys])

  if (topContent.length === 0 && bottomContent.length === 0) return null

  return (
    <Flex vertical flex={1} gap={1} style={{ minHeight: 0 }}>
      <Scrollbar style={{ flex: 1, minHeight: 0, width: '100%' }} viewStyle={{ paddingInline: '4px 8px' }}>
        <Flex vertical flex={1} gap={1} style={{ minHeight: '100%' }}>
          {topContent}
        </Flex>
      </Scrollbar>
      {bottomContent.length > 0 ? (
        <Flex vertical gap={1} style={{ flex: 'none', paddingInline: '4px 8px' }}>
          {bottomContent}
        </Flex>
      ) : null}
    </Flex>
  )
})

SidebarBody.displayName = 'SidebarBody'

export default SidebarBody
