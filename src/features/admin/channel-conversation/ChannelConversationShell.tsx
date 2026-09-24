'use client'

import { MessageSquare } from 'lucide-react'
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
  return (
    <main className='flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground'>
      <header className='shrink-0 border-b border-border bg-card/90 backdrop-blur-md'>
        <div className='mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6'>
          <div className='flex items-center gap-2'>
            <div className='flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20'>
              <MessageSquare className='size-4' />
            </div>
            <div>
              <h1 className='text-sm font-semibold tracking-tight'>{title}</h1>
              <p className='text-[11px] text-muted-foreground'>{subtitle}</p>
            </div>
          </div>
          <div className='ml-2'>
            <ConnectionBadge connected={connected} />
          </div>
          {headerExtra}
          <span className='ml-auto text-[11px] text-muted-foreground'>会话 {sessionCount}</span>
        </div>
        {banner}
      </header>

      <div className='mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 overflow-hidden'>
        {sidebar}
        {children}
      </div>
    </main>
  )
}
