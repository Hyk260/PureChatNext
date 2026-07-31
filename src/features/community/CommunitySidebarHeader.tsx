'use client'

import { ProviderIconLucide, Flexbox } from '@pure/ui'
import type { IconProps } from '@pure/ui'
import { Bot, Brain } from 'lucide-react'
import Link from '@/utils/link'
import { usePathname } from '@/utils/navigation'
import { memo, useMemo } from 'react'

import NavItem from '@/components/NavItem'
import SideBarHeaderLayout from '@/layout/SideBarHeaderLayout'

import { DiscoverTab } from '@/features/community/types'

interface NavItemConfig {
  href: string
  icon: IconProps['icon']
  key: DiscoverTab
  title: string
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    href: '/community/provider',
    icon: ProviderIconLucide,
    key: DiscoverTab.Provider,
    title: '模型服务商',
  },
  {
    href: '/community/model',
    icon: Brain,
    key: DiscoverTab.Model,
    title: '模型',
  },
  {
    href: '/community/agent',
    icon: Bot,
    key: DiscoverTab.Agent,
    title: '助理',
  },
]

const useActiveTab = () => {
  const pathname = usePathname()

  return useMemo(() => {
    for (const item of NAV_ITEMS) {
      if (pathname.startsWith(item.href)) return item.key
    }

    return DiscoverTab.Provider
  }, [pathname])
}

const CommunitySidebarHeader = memo(() => {
  const activeTab = useActiveTab()

  return (
    <>
      <SideBarHeaderLayout
        breadcrumb={[
          {
            href: '/community',
            title: '社区',
          },
        ]}
        homeHref='/'
        showHomeIcon
      />
      <Flexbox gap={1} style={{ paddingInline: 4 }}>
        {NAV_ITEMS.map((item) => (
          <Link key={item.key} href={item.href} style={{ color: 'inherit', textDecoration: 'none' }}>
            <NavItem active={activeTab === item.key} clickable icon={item.icon} title={item.title} />
          </Link>
        ))}
      </Flexbox>
    </>
  )
})

CommunitySidebarHeader.displayName = 'CommunitySidebarHeader'

export default CommunitySidebarHeader
