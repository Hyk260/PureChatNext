'use client'

import { Avatar, Button, Flexbox as Flex, Tag, Text } from '@lobehub/ui'
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
    <aside className='flex size-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-app-border-secondary bg-app-surface md:w-[280px]'>
      <Flex direction='horizontal' className='flex-between h-14 shrink-0 border-b border-app-border-secondary px-5'>
        <Text as='span' className='text-sm font-semibold'>会话列表</Text>
        <Tag shape='round' size='small'>
          {sessions.length}
        </Tag>
      </Flex>
      <Flex direction='vertical' className='min-h-0 flex-1 flex-col overflow-y-auto p-2.5'>
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
                  <Flex direction='horizontal' className='items-center gap-2'>
                    <Avatar
                      avatar={<User className='size-4' />}
                      className='shrink-0 text-muted-foreground'
                      shape='circle'
                      size={32}
                    />
                    <Text as='span' className='min-w-0 flex-1 truncate text-sm font-medium'>
                      {titleOf(session)}
                    </Text>
                    <Tag color={session.canSend ? 'green' : 'default'} size='small'>
                      {badgeOf(session)}
                    </Tag>
                  </Flex>
                  <Flex direction='horizontal' className='flex-between ml-10 gap-2 text-xs text-muted-foreground'>
                    <Text as='span' className='truncate'>
                      {session.agentTitle ?? session.agentId}
                    </Text>
                    <Text as='span' className='shrink-0'>
                      {formatDateTime(session.lastActiveAt)}
                    </Text>
                  </Flex>
                </Button>
              )
            })}
      </Flex>
    </aside>
  )
}

export function ChannelSidebarEmpty({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <Flex direction='vertical' className='flex-col items-center gap-3 px-6 py-14 text-center text-muted-foreground'>
      {icon ?? <MessageSquare className='size-8' />}
      {children}
    </Flex>
  )
}
