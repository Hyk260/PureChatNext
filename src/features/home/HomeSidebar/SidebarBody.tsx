'use client'

import { Accordion, Flexbox } from '@lobehub/ui'
import { memo, useCallback, useMemo, type Key } from 'react'

import { SIDEBAR_ACCORDION_KEYS } from '@/const/home/nav'
import AgentSection from '@/features/home/HomeSidebar/sections/AgentSection'
import RecentsSection from '@/features/home/HomeSidebar/sections/RecentsSection'
import { pickAccordionExpandedKeys } from '@/features/home/store/sidebarDefaults'
import { useHomeStore } from '@/features/home/store/useHomeStore'

const sectionComponents = {
  agents: AgentSection,
  recents: RecentsSection,
} as const

const SidebarBody = memo(() => {
  const hiddenSidebarSections = useHomeStore((s) => s.hiddenSidebarSections)
  const sidebarExpandedKeys = useHomeStore((s) => s.sidebarExpandedKeys)
  const sidebarItems = useHomeStore((s) => s.sidebarItems)
  const setSidebarAccordionExpandedKeys = useHomeStore((s) => s.setSidebarAccordionExpandedKeys)

  const visibleSections = useMemo(
    () =>
      sidebarItems.filter(
        (key) =>
          SIDEBAR_ACCORDION_KEYS.has(key) &&
          (key === 'agents' || !hiddenSidebarSections.includes(key)),
      ),
    [hiddenSidebarSections, sidebarItems],
  )

  const accordionExpandedKeys = useMemo(
    () => pickAccordionExpandedKeys(sidebarExpandedKeys, visibleSections),
    [sidebarExpandedKeys, visibleSections],
  )

  const handleAccordionExpandedChange = useCallback(
    (expandedKeys: Key[]) => {
      setSidebarAccordionExpandedKeys(visibleSections, expandedKeys.map(String))
    },
    [setSidebarAccordionExpandedKeys, visibleSections],
  )

  if (visibleSections.length === 0) return null

  return (
    <Flexbox flex={1} gap={1} paddingInline={4} style={{ minHeight: 0 }}>
      <Accordion
        expandedKeys={accordionExpandedKeys}
        gap={8}
        onExpandedChange={handleAccordionExpandedChange}
      >
        {visibleSections.map((key) => {
          const Section = sectionComponents[key as keyof typeof sectionComponents]
          if (!Section) return null
          return <Section itemKey={key} key={key} />
        })}
      </Accordion>
    </Flexbox>
  )
})

SidebarBody.displayName = 'SidebarBody'

export default SidebarBody
