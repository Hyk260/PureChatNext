'use client'

import { Flex, Drawer } from 'antd'
import { useApp } from '@/components/AntdStaticMethods'
import { Route } from 'lucide-react'
import { memo, useState } from 'react'

import NavItem from '@/components/NavItem'
import { HOME_TOP_NAV } from '@/const/home/nav'
import { RouteNavContent } from '@/features/auth/welcome/RouteNavSidebar'
import { isDev } from '@/libs/constants'
import Link from '@/utils/link'
import { usePathname } from '@/utils/navigation'

const SidebarNav = memo(() => {
  const pathname = usePathname()
  const { message } = useApp()
  const [routeNavOpen, setRouteNavOpen] = useState(false)

  return (
    <>
      <Flex vertical gap={1} style={{ paddingInline: 4 }}>
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
        {isDev ? (
          <NavItem
            icon={Route}
            title='dev测试路由'
            onItemClick={() => setRouteNavOpen(true)}
          />
        ) : null}
      </Flex>
      {isDev ? (
        <Drawer
          onClose={() => setRouteNavOpen(false)}
          open={routeNavOpen}
          placement='left'
          size={224}
          title={
            <div>
              <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                页面导航
              </p>
              <p className='mt-1 text-base font-semibold'>PureChat 路由</p>
            </div>
          }
        >
          <RouteNavContent
            pathname={pathname}
            onNavigate={() => setRouteNavOpen(false)}
          />
        </Drawer>
      ) : null}
    </>
  )
})

SidebarNav.displayName = 'SidebarNav'

export default SidebarNav
