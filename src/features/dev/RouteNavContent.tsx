'use client'

import Link from 'next/link'

import { isAdminRole } from '@/const/auth'
import { FRONTEND_ROUTE_GROUPS } from '@/const/frontend-routes'
import { useSession } from '@/libs/better-auth/client'

const isActiveRoute = (pathname: string, href: string) => {
  if (href === '/') {
    return pathname === '/'
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export type RouteNavContentProps = {
  onNavigate?: () => void
  pathname: string
}

export function RouteNavContent({ pathname, onNavigate }: RouteNavContentProps) {
  const { data: session } = useSession()
  const groups = FRONTEND_ROUTE_GROUPS.filter((group) => !group.adminOnly || isAdminRole(session?.user?.role))

  return (
    <nav aria-label='前端路由导航' className='-mx-6 -mt-4 flex-1 overflow-y-auto px-3 py-4'>
      {groups.map((group) => (
        <section className='mb-5 last:mb-0' key={group.title}>
          <h2 className='mb-2 px-2 text-xs font-medium text-muted-foreground'>{group.title}</h2>
          <ul className='space-y-0.5'>
            {group.routes.map((route) => {
              const active = isActiveRoute(pathname, route.href)

              return (
                <li key={route.href}>
                  <Link
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'block rounded-lg px-2 py-1.5 text-sm transition-colors',
                      active ? 'bg-primary/10 font-medium text-primary' : 'text-foreground hover:bg-secondary',
                    ].join(' ')}
                    href={route.href}
                    onClick={onNavigate}
                  >
                    {route.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </nav>
  )
}
