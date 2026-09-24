'use client'

import { Link2Off, MessageSquare, User } from 'lucide-react'
import { formatDateTime } from '@pure/utils/client'
import { Link } from 'react-router'

import type { WechatDevSession } from './wechatConversationApi'
import { wechatAccessLabel, wechatSessionTitle } from './wechatSessionLabels'

type WechatSessionSidebarProps = {
  bound: boolean
  onSelect: (id: string) => void
  selectedId: string | null
  sessions: WechatDevSession[]
}

function sendBadgeClass(canSend: boolean, active: boolean) {
  if (active) {
    return canSend
      ? 'bg-primary-foreground/20 text-primary-foreground'
      : 'bg-primary-foreground/15 text-primary-foreground/80'
  }
  return canSend
    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
    : 'bg-muted text-muted-foreground'
}

export function WechatSessionSidebar({ bound, onSelect, selectedId, sessions }: WechatSessionSidebarProps) {
  return (
    <aside className='flex h-full min-h-0 w-[280px] shrink-0 flex-col overflow-hidden border-r border-border bg-card'>
      <div className='flex shrink-0 items-center justify-between border-b border-border px-4 py-3'>
        <span className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>会话</span>
        <span className='rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground'>
          {sessions.length}
        </span>
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto p-2'>
        {sessions.length === 0 ? (
          <div className='flex flex-col items-center gap-3 px-6 py-14 text-center text-muted-foreground'>
            {bound ? <MessageSquare className='size-8' /> : <Link2Off className='size-8' />}
            <p className='text-sm'>{bound ? '暂无会话' : '尚未绑定微信'}</p>
            {!bound ? (
              <Link
                className='text-xs font-medium text-primary underline-offset-2 hover:underline'
                to='/settings/messenger/wechat'
              >
                前往扫码绑定
              </Link>
            ) : (
              <p className='text-xs'>用微信给 Bot 发一条消息后会出现在这里</p>
            )}
          </div>
        ) : (
          sessions.map((session) => {
            const active = session.id === selectedId
            return (
              <button
                key={session.id}
                className={`mb-1 flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground hover:bg-muted'
                }`}
                type='button'
                onClick={() => onSelect(session.id)}
              >
                <div className='flex items-center gap-2'>
                  <User className='size-3.5 shrink-0 opacity-60' />
                  <span className='min-w-0 flex-1 truncate text-xs font-medium'>
                    {wechatSessionTitle(session)}
                  </span>
                  <span
                    className={`rounded px-1 py-0.5 text-[10px] font-medium ${sendBadgeClass(session.canSend, active)}`}
                  >
                    {wechatAccessLabel(session.canSend, session.isOwnBinding)}
                  </span>
                </div>
                <div
                  className={`flex items-center justify-between gap-2 text-[10px] ${
                    active ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}
                >
                  <span className='truncate'>{session.agentTitle ?? session.agentId}</span>
                  <span className='shrink-0'>{formatDateTime(session.lastActiveAt)}</span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}
