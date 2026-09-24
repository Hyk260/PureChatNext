'use client'

import { MessageSquare, User } from 'lucide-react'
import { formatDateTime } from '@pure/utils/client'
import type { ReactNode } from 'react'

import { channelSendBadgeClass } from './channelUi'

export type ChannelSessionListItem = {
  agentId: string
  agentTitle: string | null
  canSend: boolean
  id: string
  lastActiveAt: string
}

type ChannelSessionSidebarProps<T extends ChannelSessionListItem> = {
  badgeOf: (session: T) => string
  emptyState: ReactNode
  onSelect: (id: string) => void
  selectedId: string | null
  sessions: T[]
  titleOf: (session: T) => string
}

export function ChannelSessionSidebar<T extends ChannelSessionListItem>({
  badgeOf,
  emptyState,
  onSelect,
  selectedId,
  sessions,
  titleOf,
}: ChannelSessionSidebarProps<T>) {
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
          emptyState
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
                  <span className='min-w-0 flex-1 truncate text-xs font-medium'>{titleOf(session)}</span>
                  <span
                    className={`rounded px-1 py-0.5 text-[10px] font-medium ${channelSendBadgeClass(session.canSend, active)}`}
                  >
                    {badgeOf(session)}
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

export function ChannelSidebarEmpty({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className='flex flex-col items-center gap-3 px-6 py-14 text-center text-muted-foreground'>
      {icon ?? <MessageSquare className='size-8' />}
      {children}
    </div>
  )
}
