'use client'

import Link from '@/utils/link'
import { usePathname } from '@/utils/navigation'
import { useState } from 'react'
import { Button, Drawer } from 'antd'
import { Menu } from 'lucide-react'

import { FRONTEND_ROUTE_GROUPS } from '@/const/frontend-routes'

const isActiveRoute = (pathname: string, href: string) => {
  if (href === '/') {
    return pathname === '/'
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

type RouteNavContentProps = {
  onNavigate?: () => void
  pathname: string
}

function RouteNavContent({ pathname, onNavigate }: RouteNavContentProps) {
  return (
    <nav aria-label="前端路由导航" className="-mx-6 -mt-4 flex-1 overflow-y-auto px-3 py-4">
      {FRONTEND_ROUTE_GROUPS.map((group) => (
        <section className="mb-5 last:mb-0" key={group.title}>
          <h2 className="mb-2 px-2 text-xs font-medium text-muted-foreground">{group.title}</h2>
          <ul className="space-y-0.5">
            {group.routes.map((route) => {
              const active = isActiveRoute(pathname, route.href)

              return (
                <li key={route.href}>
                  <Link
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'block rounded-lg px-2 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-foreground hover:bg-secondary',
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

export function RouteNavSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        aria-label="打开页面导航"
        className="fixed left-4 top-4 z-40"
        icon={<Menu size={16} />}
        onClick={() => setOpen(true)}
        type="default"
      />
      <Drawer
        onClose={() => setOpen(false)}
        open={open}
        placement="left"
        title={
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">页面导航</p>
            <p className="mt-1 text-base font-semibold">PureChat 路由</p>
          </div>
        }
        size={224}
      >
        <RouteNavContent onNavigate={() => setOpen(false)} pathname={pathname} />
      </Drawer>
    </>
  )
}
