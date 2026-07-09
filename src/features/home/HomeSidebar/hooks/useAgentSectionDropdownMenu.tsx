'use client'

import type { MenuProps } from '@lobehub/ui'
import { Icon } from '@lobehub/ui'
import { FolderCogIcon, SlidersHorizontalIcon } from 'lucide-react'
import { useMemo } from 'react'

import { openCustomizeSidebarModal } from '@/features/home/HomeSidebar/modals/CustomizeSidebarModal'
import { useSidebarModal } from '@/features/home/HomeSidebar/SidebarModalProvider'

export const useAgentSectionDropdownMenu = (): MenuProps['items'] => {
  const { openConfigGroupModal } = useSidebarModal()

  return useMemo(
    () => [
      {
        icon: <Icon icon={FolderCogIcon} />,
        key: 'config',
        label: '分类管理',
        onClick: (info) => {
          info.domEvent?.stopPropagation()
          openConfigGroupModal()
        },
      },
      { type: 'divider' as const },
      {
        icon: <Icon icon={SlidersHorizontalIcon} />,
        key: 'customizeSidebar',
        label: '自定义侧边栏',
        onClick: (info) => {
          info.domEvent?.stopPropagation()
          openCustomizeSidebarModal()
        },
      },
    ],
    [openConfigGroupModal],
  )
}
