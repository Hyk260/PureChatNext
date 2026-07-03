'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { FRONTEND_ROUTE_GROUPS } from '@/const/frontend-routes'

const isActiveRoute = (pathname: string, href: string) => {
  if (href === '/') {
    return pathname === '/'
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function RouteNavSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-svh w-56 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">页面导航</p>
        <p className="mt-1 text-sm font-semibold">PureChat 路由</p>
      </div>

      <nav aria-label="前端路由导航" className="flex-1 overflow-y-auto px-3 py-4">
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
    </aside>
  )
}
