'use client'

import { useChat } from '@ai-sdk/react'
import { Flexbox, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { memo, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'

import ChatInput from '@/features/chat/ChatInput'
import ChatMessages from '@/features/chat/ChatMessages'
import { loadMessages, saveMessages } from '@/features/chat/chatLocalStorage'
import { withMessageText } from '@/features/chat/messageText'
import { useHomeStore } from '@/features/home/store/useHomeStore'

const subscribeNoop = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false
const EMPTY_MESSAGES: UIMessage[] = []

const styles = createStaticStyles(({ css }) => ({
  error: css`
    padding: 8px 12px;
    border-radius: 8px;
    background: ${cssVar.colorErrorBg};
    color: ${cssVar.colorError};
    font-size: 13px;
  `,
  page: css`
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 720px;
    height: 100dvh;
    margin-inline: auto;
    padding: 24px 16px;
  `,
}))

const CHAT_ID = 'purechat-local-v1'

const chatTransport = new DefaultChatTransport({
  api: '/api/chat',
})

interface ChatViewProps {
  initialMessages: UIMessage[]
}

const ChatView = memo<ChatViewProps>(({ initialMessages }) => {
  const selectedModel = useHomeStore((s) => s.selectedModel)
  const selectedProvider = useHomeStore((s) => s.selectedProvider)

  const { messages, sendMessage, setMessages, status, error, clearError, stop } = useChat({
    id: CHAT_ID,
    messages: initialMessages,
    transport: chatTransport,
  })

  useEffect(() => {
    saveMessages(messages)
  }, [messages])

  const isBusy = status === 'submitted' || status === 'streaming'
  const isStreaming = status === 'streaming'

  const requestBody = useMemo(
    () => ({
      model: selectedModel,
      provider: selectedProvider,
    }),
    [selectedModel, selectedProvider],
  )

  const handleSend = useCallback(
    async (text: string) => {
      clearError()
      await sendMessage(
        { text },
        {
          body: requestBody,
        },
      )
    },
    [clearError, requestBody, sendMessage],
  )

  const handleDelete = useCallback(
    (id: string) => {
      setMessages((prev) => prev.filter((message) => message.id !== id))
    },
    [setMessages],
  )

  const handleEdit = useCallback(
    async (id: string, text: string) => {
      const target = messages.find((message) => message.id === id)
      if (!target) return

      clearError()

      if (target.role === 'user') {
        // Replace the user message and regenerate the assistant reply.
        await sendMessage(
          { text, messageId: id },
          {
            body: requestBody,
          },
        )
        return
      }

      setMessages((prev) =>
        prev.map((message) => (message.id === id ? withMessageText(message, text) : message)),
      )
    },
    [clearError, messages, requestBody, sendMessage, setMessages],
  )

  const handleStop = useCallback(() => {
    void stop()
  }, [stop])

  return (
    <Flexbox className={styles.page} gap={16}>
      <ChatMessages
        disabled={isBusy}
        isStreaming={isStreaming}
        messages={messages}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
      {error ? <Text className={styles.error}>{error.message || '发送失败，请稍后重试'}</Text> : null}
      <ChatInput isBusy={isBusy} onSend={handleSend} onStop={handleStop} />
    </Flexbox>
  )
})

ChatView.displayName = 'ChatView'

const ChatPage = memo(() => {
  // Defer localStorage read until after hydration to avoid SSR mismatch.
  const isClient = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot)
  const initialMessages = useMemo(
    () => (isClient ? loadMessages() : EMPTY_MESSAGES),
    [isClient],
  )

  if (!isClient) {
    return <div className={styles.page} />
  }

  return <ChatView initialMessages={initialMessages} />
})

ChatPage.displayName = 'ChatPage'

export default ChatPage
