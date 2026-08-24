'use client'

import { Accordion, AccordionItem, ScrollShadow, Text, Flexbox } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import Link from '@/utils/link'
import { usePathname } from '@/utils/navigation'
import { memo, useMemo } from 'react'

import NavItem from '@/components/NavItem'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import SideBarHeaderLayout from '@/layout/SideBarHeaderLayout'

import { SettingsGroupKey, SettingsTab, useSettingsCategory } from './useSettingsCategory'

const styles = createStaticStyles(({ css }) => ({
  sidebar: css`
    flex: none;
    width: 240px;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    background: ${cssVar.colorBgLayout};
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
    transition:
      width 0.25s ${cssVar.motionEaseInOut},
      border-color 0.25s ${cssVar.motionEaseInOut};
  `,
  sidebarCollapsed: css`
    width: 0 !important;
    border-inline-end-color: transparent;
  `,
}))

function useActiveSettingsTab(): SettingsTab {
  const pathname = usePathname()

  return useMemo(() => {
    const segment = pathname.split('/')[2]
    if (segment && Object.values(SettingsTab).includes(segment as SettingsTab)) {
      return segment as SettingsTab
    }
    return SettingsTab.Profile
  }, [pathname])
}

const SettingsSidebar = memo(() => {
  const categoryGroups = useSettingsCategory()
  const activeTab = useActiveSettingsTab()
  const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)

  return (
    <Flexbox
      className={[styles.sidebar, sidebarCollapsed ? styles.sidebarCollapsed : ''].join(' ')}
      style={{ height: '100%', width: sidebarCollapsed ? 0 : 240 }}
    >
      <Flexbox gap={1} style={{ height: '100%' }}>
        <SideBarHeaderLayout
          breadcrumb={[
            {
              href: '/settings/profile',
              title: '设置',
            },
          ]}
          homeHref='/'
          showHomeIcon
        />
        <Flexbox style={{ paddingInline: 4 }}>
          <Accordion
            defaultExpandedKeys={[SettingsGroupKey.General, SettingsGroupKey.Agent, SettingsGroupKey.System]}
            gap={8}
          >
            {categoryGroups.map((group) => (
              <AccordionItem
                itemKey={group.key}
                key={group.key}
                paddingBlock={4}
                paddingInline='8px 4px'
                title={
                  <Text ellipsis type='secondary' style={{ fontSize: 12, fontWeight: 500 }}>
                    {group.title}
                  </Text>
                }
              >
                <Flexbox gap={1} style={{ paddingBlock: 1 }}>
                  {group.items.map((item) => (
                    <Link href={item.href} key={item.key} style={{ color: 'inherit', textDecoration: 'none' }}>
                      <NavItem active={activeTab === item.key} clickable icon={item.icon} title={item.label} />
                    </Link>
                  ))}
                </Flexbox>
              </AccordionItem>
            ))}
          </Accordion>
        </Flexbox>
      </Flexbox>
    </Flexbox>
  )
})

SettingsSidebar.displayName = 'SettingsSidebar'

export default SettingsSidebar
