'use client'

import { Icon, Tooltip } from '@pure/ui'
import { cssVar } from 'antd-style'
import { ImageIcon, MessageSquareTextIcon } from 'lucide-react'
import { memo } from 'react'

import type { DiscoverModelType } from '@/features/community/types'

const TYPE_META: Record<DiscoverModelType, { icon: typeof MessageSquareTextIcon; label: string }> = {
  chat: { icon: MessageSquareTextIcon, label: 'Chat Model' },
  image: { icon: ImageIcon, label: 'Image Model' },
}

export interface ModelTypeIconProps {
  size?: number
  type: DiscoverModelType
}

const ModelTypeIcon = memo<ModelTypeIconProps>(({ type, size = 20 }) => {
  const meta = TYPE_META[type] ?? TYPE_META.chat

  return (
    <Tooltip title={meta.label}>
      <span style={{ display: 'inline-flex', lineHeight: 0 }}>
        <Icon color={cssVar.colorTextDescription} icon={meta.icon} size={size} />
      </span>
    </Tooltip>
  )
})

ModelTypeIcon.displayName = 'ModelTypeIcon'

export default ModelTypeIcon
