'use client'

import { Flex, Button, Tag } from '@pure/ui'
import { MessageSquare, User } from 'lucide-react'
import { formatDateTime } from '@pure/utils/client'
import type { ReactNode } from 'react'

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
    <aside className='flex size-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-border bg-card md:w-[300px]'>
      <Flex className='flex-between h-14 shrink-0 border-b border-border px-5'>
        <span className='text-sm font-semibold'>会话列表</span>
        <Tag shape='round' size='small'>
          {sessions.length}
        </Tag>
      </Flex>
      <div className='min-h-0 flex-1 overflow-y-auto p-2.5'>
        {sessions.length === 0
          ? emptyState
          : sessions.map((session) => {
              const active = session.id === selectedId
              return (
                <Button
                  key={session.id}
                  aria-current={active ? 'true' : undefined}
                  block
                  className={`!mb-1 !h-auto !flex-col !items-stretch !gap-1.5 !whitespace-normal !border-l-2 !px-3 !py-3 !text-left ${
                    active ? '!border-primary !bg-primary/8' : '!border-transparent hover:!bg-muted'
                  }`}
                  type='text'
                  onClick={() => onSelect(session.id)}
                >
                  <Flex className='items-center gap-2'>
                    <span className='flex-center size-8 shrink-0 rounded-full bg-muted text-muted-foreground'>
                      <User className='size-4' />
                    </span>
                    <span className='min-w-0 flex-1 truncate text-sm font-medium'>{titleOf(session)}</span>
                    <Tag color={session.canSend ? 'green' : 'default'} size='small'>
                      {badgeOf(session)}
                    </Tag>
                  </Flex>
                  <Flex className='flex-between ml-10 gap-2 text-xs text-muted-foreground'>
                    <span className='truncate'>{session.agentTitle ?? session.agentId}</span>
                    <span className='shrink-0'>{formatDateTime(session.lastActiveAt)}</span>
                  </Flex>
                </Button>
              )
            })}
      </div>
    </aside>
  )
}

export function ChannelSidebarEmpty({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <Flex className='flex-col items-center gap-3 px-6 py-14 text-center text-muted-foreground'>
      {icon ?? <MessageSquare className='size-8' />}
      {children}
    </Flex>
  )
}
