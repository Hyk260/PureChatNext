'use client'

import { AccordionRoot, AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger, Text, Flex } from '@pure/ui'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { memo, useMemo } from 'react'

import NavItem from '@/components/NavItem'
import Scrollbar from '@/components/Scrollbar'
import { isAdminRole } from '@/const/auth'
import SideBarHeaderLayout from '@/layout/SideBarHeaderLayout'
import { useSession } from '@/libs/better-auth/client'

import { SettingsGroupKey, SettingsTab, useSettingsCategory } from './useSettingsCategory'

const DEFAULT_EXPANDED_GROUPS = [
  SettingsGroupKey.General,
  SettingsGroupKey.Agent,
  SettingsGroupKey.Tools,
  SettingsGroupKey.System,
  SettingsGroupKey.Manage,
]

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
  const { data: session } = useSession()
  const categoryGroups = useSettingsCategory(isAdminRole(session?.user?.role))
  const activeTab = useActiveSettingsTab()

  return (
    <Flex className='h-full w-60 min-w-0 flex-none flex-col overflow-hidden bg-app-layout'>
      <Flex className='flex-col gap-px h-full w-[240px]'>
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
        <Scrollbar style={{ flex: 1, minHeight: 0, width: '100%' }}>
          <Flex className='flex-col ps-1 pe-3'>
            <AccordionRoot
              multiple
              defaultValue={DEFAULT_EXPANDED_GROUPS}
              style={{ gap: 8 }}
            >
              {categoryGroups.map((group) => (
                <AccordionItem value={group.key} key={group.key}>
                  <AccordionHeader style={{ paddingBlock: 4, paddingInline: '8px 4px' }}>
                    <AccordionTrigger>
                      <Text className='text-[12px] font-medium' ellipsis type='secondary'>
                        {group.title}
                      </Text>
                    </AccordionTrigger>
                  </AccordionHeader>
                  <AccordionPanel>
                    <Flex className='flex-col gap-px py-px'>
                      {group.items.map((item) => (
                        <Link className='text-inherit no-underline' href={item.href} key={item.key}>
                          <NavItem active={activeTab === item.key} clickable icon={item.icon} title={item.label} />
                        </Link>
                      ))}
                    </Flex>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </AccordionRoot>
          </Flex>
        </Scrollbar>
      </Flex>
    </Flex>
  )
})

SettingsSidebar.displayName = 'SettingsSidebar'

export default SettingsSidebar
