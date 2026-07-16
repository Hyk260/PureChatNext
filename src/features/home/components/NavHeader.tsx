'use client'

import { ActionIcon, Avatar, Flexbox } from '@lobehub/ui'
import { createStaticStyles } from 'antd-style'
import { PanelLeftOpen } from 'lucide-react'
import Link from '@/utils/link'
import { memo } from 'react'

import { useHomeStore } from '@/features/home/store/useHomeStore'
import { useSession } from '@/libs/better-auth/client'

const styles = createStaticStyles(({ css }) => ({
  header: css`
    flex: none;
  `,
}))

const NavHeader = memo(() => {
  const { data: session } = useSession()
  const sidebarCollapsed = useHomeStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useHomeStore((s) => s.toggleSidebarCollapsed)

  const displayName = session?.user?.name ?? session?.user?.email?.split('@')[0] ?? '访客'

  return (
    <Flexbox horizontal align='center' className={styles.header} height={44} justify='space-between' padding={8}>
      <Flexbox horizontal align='center' gap={2}>
        {sidebarCollapsed ? (
          <ActionIcon icon={PanelLeftOpen} size='small' title='展开侧栏' onClick={toggleSidebarCollapsed} />
        ) : null}
      </Flexbox>
      {/* 
      <Flexbox horizontal align='center' gap={8}>
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

NavHeader.displayName = 'NavHeader'

export default NavHeader
