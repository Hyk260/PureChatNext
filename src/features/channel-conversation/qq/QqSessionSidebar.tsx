'use client'

import {
  ChannelSessionSidebar,
  ChannelSidebarEmpty,
  channelAccessLabel,
} from '@/features/channel-conversation'
import { Text } from '@lobehub/ui'

import type { QQSession } from './qqConversationApi'
import { qqSessionTitle } from './qqSessionLabels'

type QqSessionSidebarProps = {
  bound: boolean
  onSelect: (id: string) => void
  selectedId: string | null
  sessions: QQSession[]
}

export function QqSessionSidebar({ bound, onSelect, selectedId, sessions }: QqSessionSidebarProps) {
  return (
    <ChannelSessionSidebar
      badgeOf={(session) => channelAccessLabel(session.canSend, session.isOwnBinding)}
      emptyState={
        <ChannelSidebarEmpty>
          <Text as='p' className='text-sm'>
            {bound ? '暂无会话' : '尚未绑定 QQ'}
          </Text>
        </ChannelSidebarEmpty>
      }
      selectedId={selectedId}
      sessions={sessions}
      titleOf={qqSessionTitle}
      onSelect={onSelect}
    />
  )
}
