'use client'

import { Code2, Rocket, ServerCog } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const categories = [
  {
    description: '安装与启动',
    href: '/getting-started/quick-start',
    icon: Rocket,
    match: '/getting-started',
    title: '快速开始',
  },
  {
    description: '部署与配置',
    href: '/self-hosting',
    icon: ServerCog,
    match: '/self-hosting',
    title: '自托管',
  },
  {
    description: '参与贡献',
    href: '/development',
    icon: Code2,
    match: '/development',
    title: '开发指南',
  },
]

export function CategorySwitcher() {
  const pathname = usePathname()

  return (
    <nav aria-label='文档分类' className='grid grid-cols-3 gap-1.5'>
      {categories.map(({ description, href, icon: Icon, match, title }) => {
        const active = pathname.startsWith(match)

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className='docs-category-link'
            data-active={active}
            href={href}
            key={href}
            title={description}
          >
            <Icon aria-hidden className='size-4' />
            <span>{title}</span>
          </Link>
        )
      })}
    </nav>
  )
}
