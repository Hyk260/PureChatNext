'use client'

import { App } from 'antd'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { memo } from 'react'

import NavItem from '@/components/NavItem'
import { HOME_TOP_NAV } from '@/const/home/nav'
import { Flexbox } from '@lobehub/ui'

const SidebarNav = memo(() => {
  const pathname = usePathname()
  const { message } = App.useApp()

  return (
    <Flexbox gap={1} paddingInline={4}>
      {HOME_TOP_NAV.map((item) => {
        const active = item.key === 'home' && pathname === '/'

        if (item.key === 'search') {
          return (
            <NavItem
              key={item.key}
              icon={item.icon}
              title={item.title}
              onItemClick={() => message.info('搜索功能即将推出')}
            />
          )
        }

        if (!item.href || item.href === '#') {
          return (
            <NavItem
              key={item.key}
              icon={item.icon}
              title={item.title}
              onItemClick={() => message.info('功能即将推出')}
            />
          )
        }

        return (
          <Link
            key={item.key}
            href={item.href}
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            <NavItem active={active} clickable icon={item.icon} title={item.title} />
          </Link>
        )
      })}
    </Flexbox>
  )
})

SidebarNav.displayName = 'SidebarNav'

export default SidebarNav
