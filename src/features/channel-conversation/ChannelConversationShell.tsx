'use client'

import { Button, Flexbox as Flex, Text } from '@lobehub/ui'
import { ArrowLeft, ArrowRight, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { ConnectionBadge } from './ConversationShared'

type ChannelConversationShellProps = {
  banner?: ReactNode
  children: ReactNode
  connected?: boolean
  headerExtra?: ReactNode
  sessionCount: number
  sidebar: (onSessionSelected: () => void) => ReactNode
  subtitle: string
  title: string
  titleExtra?: ReactNode
}

export function ChannelConversationShell({
  banner,
  children,
  connected,
  headerExtra,
  sessionCount,
  sidebar,
  subtitle,
  title,
  titleExtra,
}: ChannelConversationShellProps) {
  const [showSessions, setShowSessions] = useState(true)

  return (
    <main className='flex h-full min-h-0 flex-col overflow-hidden bg-app-layout text-foreground'>
      <header className='shrink-0 border-b border-app-border-secondary bg-app-surface'>
        <Flex direction='horizontal' className='w-full items-center gap-3 px-4 py-3 sm:px-6'>
          <Flex direction='horizontal' className='flex-center size-9 shrink-0 rounded-lg bg-muted text-muted-foreground'>
            <MessageSquare className='size-4' />
          </Flex>
          <Flex direction='vertical' className='min-w-0 flex-col'>
            <Text as='h1' className='truncate text-sm font-semibold tracking-tight'>
              {title}
            </Text>
            <Flex direction='horizontal' className='items-center gap-2'>
              <Text as='p' className='truncate text-xs text-muted-foreground'>
                {subtitle}
              </Text>
              {titleExtra}
            </Flex>
          </Flex>
          <Flex direction='horizontal' className='ml-auto items-center gap-2'>
            {headerExtra}
            {connected === undefined ? null : <ConnectionBadge connected={connected} />}
            <Text as='span' className='hidden text-xs text-muted-foreground sm:inline'>
              会话 {sessionCount}
            </Text>
            <Button
              aria-label={showSessions ? '查看消息' : '查看会话列表'}
              className='md:hidden'
              icon={showSessions ? <ArrowRight className='size-4' /> : <ArrowLeft className='size-4' />}
              size='small'
              title={showSessions ? '查看消息' : '查看会话列表'}
              type='text'
              onClick={() => setShowSessions((current) => !current)}
            />
          </Flex>
        </Flex>
        {banner}
      </header>

      <Flex direction='horizontal' className='min-h-0 w-full flex-1 overflow-hidden'>
        <Flex direction='vertical' className={`${showSessions ? 'flex' : 'hidden'} min-h-0 w-full shrink-0 md:flex md:w-auto`}>
          {sidebar(() => setShowSessions(false))}
        </Flex>
        <Flex direction='vertical' className={`${showSessions ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-1 md:flex`}>
          {children}
        </Flex>
      </Flex>
    </main>
  )
}
