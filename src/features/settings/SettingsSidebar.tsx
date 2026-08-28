'use client'

import { Accordion, AccordionItem, ScrollShadow, Text, Flex } from '@pure/ui'
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
    <Flex
      className={[styles.sidebar, sidebarCollapsed && styles.sidebarCollapsed, 'flex-col h-full']}
      style={{ width: sidebarCollapsed ? 0 : 240 }}
    >
      <Flex className='flex-col gap-px h-full'>
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
        <Flex className='flex-col px-1'>
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
                <Flex className='flex-col gap-px py-px'>
                  {group.items.map((item) => (
                    <Link className='text-inherit no-underline' href={item.href} key={item.key}>
                      <NavItem active={activeTab === item.key} clickable icon={item.icon} title={item.label} />
                    </Link>
                  ))}
                </Flex>
              </AccordionItem>
            ))}
          </Accordion>
        </Flex>
      </Flex>
    </Flex>
  )
})

SettingsSidebar.displayName = 'SettingsSidebar'

export default SettingsSidebar
