'use client'

import { Flex } from '@pure/ui'
import { Drawer } from 'antd'
import { useApp } from '@/components/AntdStaticMethods'
import { FileText, Globe2, Mail, Route, Users } from 'lucide-react'
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
  const { message } = useApp()
  const [routeNavOpen, setRouteNavOpen] = useState(false)
  const showAdminNav = isAdminRole(session?.user?.role)

  return (
    <>
      <Flex className='flex-col gap-px px-1'>
        {HOME_TOP_NAV.map((item) => {
          const active = item.href === '/' ? pathname === '/' : Boolean(item.href && pathname.startsWith(item.href))

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
            <Link className='text-inherit no-underline' key={item.key} href={item.href}>
              <NavItem active={active} clickable icon={item.icon} title={item.title} />
            </Link>
          )
        })}
        {showAdminNav ? (
          <>
            <Link className='text-inherit no-underline' href='/admin/users'>
              <NavItem
                active={pathname.startsWith('/admin/users')}
                clickable
                icon={Users}
                title='用户管理'
              />
            </Link>
            <Link className='text-inherit no-underline' href='/admin/web-search'>
              <NavItem
                active={pathname.startsWith('/admin/web-search')}
                clickable
                icon={Globe2}
                title='联网搜索'
              />
            </Link>
            <Link className='text-inherit no-underline' href='/admin/email-service'>
              <NavItem
                active={pathname.startsWith('/admin/email-service')}
                clickable
                icon={Mail}
                title='邮件服务'
              />
            </Link>
            <Link className='text-inherit no-underline' href='/admin/read-file'>
              <NavItem
                active={pathname.startsWith('/admin/read-file')}
                clickable
                icon={FileText}
                title='文件读取'
              />
            </Link>
          </>
        ) : null}
        {isDev ? <NavItem icon={Route} title='dev测试路由' onItemClick={() => setRouteNavOpen(true)} /> : null}
      </Flex>
      {isDev ? (
        <Drawer
          onClose={() => setRouteNavOpen(false)}
          open={routeNavOpen}
          placement='left'
          size={224}
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
