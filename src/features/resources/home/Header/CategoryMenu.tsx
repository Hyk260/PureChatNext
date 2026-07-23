'use client'

import { Flex } from 'antd'
import Link from '@/utils/link'
import { usePathname, useSearchParams } from '@/utils/navigation'
import { memo } from 'react'

import { FileText, ImageIcon, LayoutPanelTopIcon, Mic2, SquarePlay , type LucideIcon } from 'lucide-react'

import NavItem from '@/components/NavItem'
import { FilesTabs } from '@/types/files'

const CATEGORIES: { icon: LucideIcon; key: FilesTabs; label: string }[] = [
  { icon: LayoutPanelTopIcon, key: FilesTabs.All, label: '全部' },
  { icon: FileText, key: FilesTabs.Documents, label: '文档' },
  { icon: ImageIcon, key: FilesTabs.Images, label: '图片' },
  { icon: Mic2, key: FilesTabs.Audios, label: '音频' },
  { icon: SquarePlay, key: FilesTabs.Videos, label: '视频' },
]

const CategoryMenu = memo(() => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const category = searchParams.get('category') ?? FilesTabs.All

  if (!pathname.startsWith('/resources') || pathname.includes('/library/')) return null

  return (
    <Flex vertical gap={1} style={{ paddingInline: 8 }}>
      {CATEGORIES.map((item) => {
        const href =
          item.key === FilesTabs.All ? '/resources' : `/resources?category=${item.key}`
        const active = category === item.key

        return (
          <Link key={item.key} href={href} style={{ color: 'inherit', textDecoration: 'none' }}>
            <NavItem active={active} clickable icon={item.icon} title={item.label} />
          </Link>
        )
      })}
    </Flex>
  )
})

CategoryMenu.displayName = 'CategoryMenu'

export default CategoryMenu
