'use client'

import { Accordion, AccordionItem, Flexbox, ScrollShadow, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { memo, useMemo } from 'react'

import NavItem from '@/components/NavItem'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import SideBarHeaderLayout from '@/layout/SideBarHeaderLayout'

import {
  SettingsGroupKey,
  SettingsTab,
  useSettingsCategory,
} from './useSettingsCategory'

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
      height="100%"
      style={{ width: sidebarCollapsed ? 0 : 240 }}
    >
      <ScrollShadow size={2} style={{ height: '100%', width: 240 }}>
        <Flexbox gap={1} height="100%" paddingBlock={4}>
          <SideBarHeaderLayout
            breadcrumb={[
              {
                href: '/settings/profile',
                title: '设置',
              },
            ]}
            homeHref="/"
            showHomeIcon
          />
          <Flexbox paddingInline={4}>
            <Accordion
              defaultExpandedKeys={[
                SettingsGroupKey.General,
                SettingsGroupKey.Agent,
                SettingsGroupKey.System,
              ]}
              gap={8}
            >
              {categoryGroups.map((group) => (
                <AccordionItem
                  itemKey={group.key}
                  key={group.key}
                  paddingBlock={4}
                  paddingInline="8px 4px"
                  title={
                    <Text ellipsis fontSize={12} type="secondary" weight={500}>
                      {group.title}
                    </Text>
                  }
                >
                  <Flexbox gap={1} paddingBlock={1}>
                    {group.items.map((item) => (
                      <Link
                        href={item.href}
                        key={item.key}
                        style={{ color: 'inherit', textDecoration: 'none' }}
                      >
                        <NavItem
                          active={activeTab === item.key}
                          clickable
                          icon={item.icon}
                          title={item.label}
                        />
                      </Link>
                    ))}
                  </Flexbox>
                </AccordionItem>
              ))}
            </Accordion>
          </Flexbox>
        </Flexbox>
      </ScrollShadow>
    </Flexbox>
  )
})

SettingsSidebar.displayName = 'SettingsSidebar'

export default SettingsSidebar
