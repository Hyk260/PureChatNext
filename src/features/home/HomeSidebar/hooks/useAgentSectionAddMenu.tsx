'use client'

import { Icon } from '@pure/ui'
import type { MenuProps } from '@pure/ui'
import { BotIcon, StoreIcon } from 'lucide-react'
import { useMemo } from 'react'

import { stopMenuEvent } from '@/libs/utils/menu'

export const useAgentSectionAddMenu = (options: {
  onCreateAgent: () => void
  onAddFromMarket: () => void
}): MenuProps['items'] => {
  const { onCreateAgent, onAddFromMarket } = options

  return useMemo(
    () => [
      {
        icon: <Icon icon={BotIcon} />,
        key: 'createAgent',
        label: '创建助理',
        onClick: (info) => {
          stopMenuEvent(info)
          onCreateAgent()
        },
      },
      {
        icon: <Icon icon={StoreIcon} />,
        key: 'addFromMarket',
        label: '从市场添加助理',
        onClick: (info) => {
          stopMenuEvent(info)
          onAddFromMarket()
        },
      },
    ],
    [onAddFromMarket, onCreateAgent]
  )
}
