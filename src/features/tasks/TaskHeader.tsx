'use client'

import { ActionIcon } from '@lobehub/ui'
import { Flex } from '@pure/ui'
import { PanelLeftOpen } from 'lucide-react'
import type { ReactNode } from 'react'
import { useHomeStore } from '@/features/home/store/useHomeStore'

export function TaskHeader({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const collapsed = useHomeStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useHomeStore((state) => state.toggleSidebarCollapsed)
  return (
    <header className='flex-between min-h-16 shrink-0 gap-3 px-4 py-3 sm:px-6'>
      <Flex className='min-w-0 items-center gap-2'>
        {collapsed && <ActionIcon icon={PanelLeftOpen} title='展开侧栏' onClick={toggleSidebar} />}
        {children}
      </Flex>
      <Flex className='shrink-0 items-center gap-2'>{actions}</Flex>
    </header>
  )
}
