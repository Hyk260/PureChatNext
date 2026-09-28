'use client'

import { Button } from '@pure/ui'
import { ArrowLeft, ArrowRight, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { ConnectionBadge } from './ConversationShared'

type ChannelConversationShellProps = {
  banner?: ReactNode
  children: ReactNode
  connected: boolean
  headerExtra?: ReactNode
  sessionCount: number
  sidebar: ReactNode
  subtitle: string
  title: string
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
}: ChannelConversationShellProps) {
  const [showSessions, setShowSessions] = useState(true)

  return (
    <main className='flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground'>
      <header className='shrink-0 border-b border-border bg-card'>
        <div className='mx-auto flex w-full max-w-[1440px] items-center gap-3 px-4 py-3 sm:px-6'>
          <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground'>
            <MessageSquare className='size-4' />
          </div>
          <div className='min-w-0'>
            <h1 className='truncate text-sm font-semibold tracking-tight'>{title}</h1>
            <p className='truncate text-xs text-muted-foreground'>{subtitle}</p>
          </div>
          <div className='ml-auto flex items-center gap-2'>
            {headerExtra}
            <ConnectionBadge connected={connected} />
            <span className='hidden text-xs text-muted-foreground sm:inline'>会话 {sessionCount}</span>
            <Button
              aria-label={showSessions ? '查看消息' : '查看会话列表'}
              className='md:hidden'
              icon={showSessions ? <ArrowRight className='size-4' /> : <ArrowLeft className='size-4' />}
              size='small'
              title={showSessions ? '查看消息' : '查看会话列表'}
              type='text'
              onClick={() => setShowSessions((current) => !current)}
            />
          </div>
        </div>
        {banner}
      </header>

      <div className='mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 overflow-hidden'>
        <div
          className={`${showSessions ? 'flex' : 'hidden'} min-h-0 w-full shrink-0 md:flex md:w-auto`}
          onClickCapture={(event) => {
            if (event.target instanceof Element && event.target.closest('button')) setShowSessions(false)
          }}
        >
          {sidebar}
        </div>
        <div className={`${showSessions ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-1 md:flex`}>{children}</div>
      </div>
    </main>
  )
}
