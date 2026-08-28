'use client'

import { Avatar } from 'antd'
import { ActionIcon, Flex } from '@pure/ui'
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
    <Flex className={[styles.header, 'flex-between h-[40px] p-2']}>
      <Flex className='flex-row items-center gap-0.5'>
        {sidebarCollapsed ? (
          <ActionIcon icon={PanelLeftOpen} size='small' title='展开侧栏' onClick={toggleSidebarCollapsed} />
        ) : null}
      </Flex>
      {/* <Flex className='flex-row items-center gap-2'>
        {session?.user ? (
          <Link className='text-inherit no-underline' href='/settings/profile'>
            <Avatar shape='circle' size={28}>{displayName.slice(0, 1).toUpperCase()}</Avatar>
          </Link>
        ) : (
          <Link className='text-inherit no-underline' href='/signin'>
            <Avatar shape='circle' size={28}>?</Avatar>
          </Link>
        )}
      </Flex> */}
    </Flex>
  )
})

NavHeader.displayName = 'NavHeader'

export default NavHeader
