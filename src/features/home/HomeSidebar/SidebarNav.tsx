'use client'

import { toast, Drawer } from '@lobehub/ui'
import { Flex } from '@pure/ui'
import { Route } from 'lucide-react'
import { memo, useState } from 'react'

import NavItem from '@/components/NavItem'
import { isAdminRole } from '@/const/auth'
import { HOME_TOP_NAV } from '@/const/home/nav'
import { RouteNavContent } from '@/features/dev/RouteNavContent'
import { useSession } from '@/libs/better-auth/client'
import { isDev } from '@/libs/constants'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SidebarNav = memo(() => {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [routeNavOpen, setRouteNavOpen] = useState(false)
  const isAdmin = isAdminRole(session?.user?.role)
  const visibleNavItems = HOME_TOP_NAV.filter((item) => item.key !== 'tasks' || isAdmin)

  return (
    <>
      <Flex className='flex-col gap-px px-1'>
        {visibleNavItems.map((item) => {
          const active = item.href === '/' ? pathname === '/' : Boolean(item.href && pathname.startsWith(item.href))

          if (item.key === 'search') {
            return (
              <NavItem
                key={item.key}
                icon={item.icon}
                title={item.title}
                onItemClick={() => toast.info('搜索功能即将推出')}
              />
            )
          }

          if (!item.href || item.href === '#') {
            return (
              <NavItem
                key={item.key}
                icon={item.icon}
                title={item.title}
                onItemClick={() => toast.info('功能即将推出')}
              />
            )
          }

          return (
            <Link className='text-inherit no-underline' key={item.key} href={item.href}>
              <NavItem active={active} clickable icon={item.icon} title={item.title} />
            </Link>
          )
        })}
        {isDev ? <NavItem icon={Route} title='dev测试路由' onItemClick={() => setRouteNavOpen(true)} /> : null}
      </Flex>
      {isDev ? (
        <Drawer
          onClose={() => setRouteNavOpen(false)}
          open={routeNavOpen}
          placement='left'
          width={224}
          title={
            <div>
              <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>页面导航</p>
              <p className='mt-1 text-base font-semibold'>PureChat 路由</p>
            </div>
          }
        >
          <RouteNavContent pathname={pathname} onNavigate={() => setRouteNavOpen(false)} />
        </Drawer>
      ) : null}
    </>
  )
})

SidebarNav.displayName = 'SidebarNav'

export default SidebarNav
