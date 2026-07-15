'use client'

import type { MenuInfo, MenuProps } from '@lobehub/ui'
import { Icon } from '@lobehub/ui'
import { FolderCogIcon, SlidersHorizontalIcon } from 'lucide-react'
import { useMemo } from 'react'

import { openCustomizeSidebarModal } from '@/features/home/HomeSidebar/modals/CustomizeSidebarModal'
import { useSidebarModal } from '@/features/home/HomeSidebar/SidebarModalProvider'

const stopMenuEvent = (info: MenuInfo) => {
  const event = info.domEvent as { stopPropagation?: () => void } | undefined
  event?.stopPropagation?.()
}

/** 「⋯」菜单：分类管理 / 自定义侧边栏（创建入口在「+」菜单） */
export const useAgentSectionDropdownMenu = (): MenuProps['items'] => {
  const { openConfigGroupModal } = useSidebarModal()

  return useMemo(
    () => [
      {
        icon: <Icon icon={FolderCogIcon} />,
        key: 'config',
        label: '分类管理',
        onClick: (info) => {
          stopMenuEvent(info)
          openConfigGroupModal()
        },
      },
      { type: 'divider' },
      {
        icon: <Icon icon={SlidersHorizontalIcon} />,
        key: 'customizeSidebar',
        label: '自定义侧边栏',
        onClick: (info) => {
          stopMenuEvent(info)
          openCustomizeSidebarModal()
        },
      },
    ],
    [openConfigGroupModal],
  )
}
