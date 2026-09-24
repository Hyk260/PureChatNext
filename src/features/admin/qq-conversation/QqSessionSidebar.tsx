'use client'

import {
  ChannelSessionSidebar,
  ChannelSidebarEmpty,
  channelAccessLabel,
} from '@/features/admin/channel-conversation'

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
          <p className='text-sm'>{bound ? '暂无会话' : '尚未绑定 QQ'}</p>
        </ChannelSidebarEmpty>
      }
      selectedId={selectedId}
      sessions={sessions}
      titleOf={qqSessionTitle}
      onSelect={onSelect}
    />
  )
}
