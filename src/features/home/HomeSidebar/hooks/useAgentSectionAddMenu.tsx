'use client'

import { type MenuInfo, type MenuProps } from '@pure/ui'
import { Icon } from '@pure/ui'
import { BotIcon, StoreIcon } from 'lucide-react'
import { useMemo } from 'react'

const stopMenuEvent = (info: MenuInfo) => {
  const event = info.domEvent as { stopPropagation?: () => void } | undefined
  event?.stopPropagation?.()
}

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
    [onAddFromMarket, onCreateAgent],
  )
}
