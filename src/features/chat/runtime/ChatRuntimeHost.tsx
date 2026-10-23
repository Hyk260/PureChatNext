import { useChat } from '@ai-sdk/react'
import { useLayoutEffect } from 'react'

import { useSession } from '@/libs/better-auth/client'

import type { ChatSession } from './chatSession'
import { setChatRuntimeOwner, useChatRuntimeStore } from './store'

const SessionObserver = ({ session }: { session: ChatSession }) => {
  const { messages, status } = useChat({ chat: session.chat })
  useLayoutEffect(() => {
    session.observe(messages)
  }, [messages, session, status])
  return null
}

/** Mounted above routes so navigation only detaches the visible message list. */
const ChatRuntimeHost = () => {
  const { data: auth, isPending } = useSession()
  const sessions = useChatRuntimeStore((state) => state.sessions)
  const userId = auth?.user.id ?? null
  useLayoutEffect(() => {
    if (!isPending) setChatRuntimeOwner(userId)
  }, [isPending, userId])

  return [...sessions.values()].map((session) => <SessionObserver key={session.key} session={session} />)
}

export default ChatRuntimeHost
