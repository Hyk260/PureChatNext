'use client'

import { ActionIcon, Avatar, Flexbox, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { PanelLeftOpen } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { memo, useMemo } from 'react'

import { useHomeStore } from '@/features/home/store/useHomeStore'
import { useSession } from '@/libs/better-auth/auth-client'

import { DiscoverTab } from '@/features/community/types'

const styles = createStaticStyles(({ css }) => ({
  header: css`
    flex: none;
    height: 53px;
    padding-inline: 8px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
  `,
}))

const PAGE_TITLES: Record<DiscoverTab, string> = {
  [DiscoverTab.Provider]: '模型服务商',
  [DiscoverTab.Model]: '模型',
  [DiscoverTab.Agent]: '助理',
}

const usePageTitle = () => {
  const pathname = usePathname()

  return useMemo(() => {
    if (pathname.startsWith('/community/model')) return PAGE_TITLES[DiscoverTab.Model]
    if (pathname.startsWith('/community/agent')) return PAGE_TITLES[DiscoverTab.Agent]

    return PAGE_TITLES[DiscoverTab.Provider]
  }, [pathname])
}

const CommunityHeader = memo(() => {
  const title = usePageTitle()
  const { data: session } = useSession()
  const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useHomeStore((s) => s.toggleSidebarCollapsed)

  const displayName =
    session?.user?.name ?? session?.user?.email?.split('@')[0] ?? '访客'

  return (
    <Flexbox
      horizontal
      align='center'
      className={styles.header}
      justify='space-between'
    >
      <Flexbox horizontal align='center' flex={1} gap={8} style={{ overflow: 'hidden' }}>
        {sidebarCollapsed ? (
          <ActionIcon
            icon={PanelLeftOpen}
            size='small'
            title='展开侧栏'
            onClick={toggleSidebarCollapsed}
          />
        ) : null}
        <Text ellipsis fontSize={16} strong>
          {title}
        </Text>
      </Flexbox>

      {/* <Flexbox horizontal align='center' gap={8}>
        {session?.user ? (
          <Link href='/settings/profile' style={{ color: 'inherit', textDecoration: 'none' }}>
            <Avatar avatar={displayName.slice(0, 1).toUpperCase()} shape='circle' size={28} />
          </Link>
        ) : (
          <Link href='/signin' style={{ color: 'inherit', textDecoration: 'none' }}>
            <Avatar avatar='?' shape='circle' size={28} />
          </Link>
        )}
      </Flexbox> */}
    </Flexbox>
  )
})

CommunityHeader.displayName = 'CommunityHeader'

export default CommunityHeader
