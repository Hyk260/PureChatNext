'use client'

import { Link2Off, MessageSquare } from 'lucide-react'
import { Text } from '@lobehub/ui'
import { Link } from 'react-router'

import {
  ChannelSessionSidebar,
  ChannelSidebarEmpty,
} from '@/features/channel-conversation'

import type { WechatDevSession } from './wechatConversationApi'
import { wechatAccessLabel, wechatSessionTitle } from './wechatSessionLabels'

type WechatSessionSidebarProps = {
  bound: boolean
  onSelect: (id: string) => void
  selectedId: string | null
  sessions: WechatDevSession[]
}

export function WechatSessionSidebar({ bound, onSelect, selectedId, sessions }: WechatSessionSidebarProps) {
  return (
    <ChannelSessionSidebar
      badgeOf={(session) => wechatAccessLabel(session.canSend, session.isOwnBinding)}
      emptyState={
        <ChannelSidebarEmpty icon={bound ? <MessageSquare className='size-8' /> : <Link2Off className='size-8' />}>
          <Text as='p' className='text-sm'>
            {bound ? '暂无会话' : '尚未绑定微信'}
          </Text>
          {!bound ? (
            <Link
              className='text-xs font-medium text-primary underline-offset-2 hover:underline'
              to='/settings/messenger/wechat'
            >
              前往扫码绑定
            </Link>
          ) : (
            <Text as='p' className='text-xs'>用微信给 Bot 发一条消息后会出现在这里</Text>
          )}
        </ChannelSidebarEmpty>
      }
      selectedId={selectedId}
      sessions={sessions}
      titleOf={wechatSessionTitle}
      onSelect={onSelect}
    />
  )
}
