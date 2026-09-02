'use client'

import { Avatar, Flex } from '@pure/ui'
import { memo, useEffect, useState } from 'react'

import NotFound from '@/components/404'
import Loading from '@/components/Loading/BrandTextLoading'
import { getMessageText } from '@/features/chat/messageText'
import MessageMarkdown from '@/features/chat/MessageMarkdown'
import { useParams } from '@/utils/navigation'

import { fetchPublicTopicShare } from './shareApi'
import type { PublicTopicShare } from './shareApi'

const ShareTopicPage = memo(() => {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<PublicTopicShare>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setData(undefined)

    fetchPublicTopicShare(id ?? '')
      .then((share) => {
        if (!cancelled) setData(share)
      })
      .catch(() => {
        if (!cancelled) setData(undefined)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return <Loading debugId='Share' />
  if (!data) return <NotFound />

  return (
    <div className='h-[100dvh] overflow-y-auto bg-background text-foreground'>
      <main className='mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-6 md:px-8 md:py-10'>
        <header className='flex items-center gap-3 border-b border-border pb-5'>
          <Avatar avatar={data.agent.avatar ?? '✨'} size={36} />
          <div className='min-w-0'>
            <h1 className='m-0 truncate text-xl font-semibold'>{data.title}</h1>
            <p className='m-0 text-sm text-muted-foreground'>{data.agent.title}</p>
          </div>
        </header>

        <Flex className='mx-auto w-full max-w-3xl flex-col gap-5'>
          {data.messages.map((message) => {
            const text = getMessageText(message)
            if (!text) return null

            return message.role === 'user' ? (
              <div className='self-end whitespace-pre-wrap rounded-2xl bg-muted px-4 py-3 text-[15px] leading-7' key={message.id}>
                {text}
              </div>
            ) : (
              <article className='w-full text-[15px] leading-7' key={message.id}>
                <MessageMarkdown text={text} />
              </article>
            )
          })}
        </Flex>

        <p className='m-0 border-t border-border pt-5 text-center text-xs text-muted-foreground'>
          此内容来自 PureChat 分享，仅供查看。
        </p>
      </main>
    </div>
  )
})

ShareTopicPage.displayName = 'ShareTopicPage'

export default ShareTopicPage
