'use client'

import { Avatar, Text, Flex } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import type { UIMessage } from 'ai'
import { memo, useCallback, useEffect, useRef } from 'react'

import Scrollbar from '@/components/Scrollbar'
import type { ScrollbarRef } from '@/components/Scrollbar'
import ChatMessageItem from '@/features/chat/ChatMessageItem'
import { getMessageReasoning, getMessageText } from '@/features/chat/messageText'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import { useAutoScroll } from '@/features/chat/useAutoScroll'
import { getWebSearchStatusSignature } from '@/features/chat/WebSearchStatus'
import { CONVERSATION_MAX_WIDTH } from '@/features/chat/WideScreenContainer'

export interface AgentMeta {
  avatar: string
  openingMessage?: string | null
  openingQuestions?: string[] | null
  title: string
}

const styles = createStaticStyles(({ css }) => ({
  content: css`
    box-sizing: border-box;
    min-height: 100%;
    margin-inline: auto;
    padding: 16px 16px 28px;
    transition: width 0.25s ${cssVar.motionEaseInOut};
  `,
  empty: css`
    color: ${cssVar.colorTextQuaternary};
    text-align: center;
  `,
  openingMessage: css`
    max-width: 640px;
    font-size: 15px;
    line-height: 1.6;
    color: ${cssVar.colorText};
    text-align: center;
    white-space: pre-wrap;
  `,
  questionChip: css`
    max-width: 100%;
    padding-block: 8px;
    padding-inline: 12px;
    border-radius: 999px;
    cursor: pointer;
    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorFillTertiary};
    transition: background 0.2s ${cssVar.motionEaseInOut};

    &:hover {
      background: ${cssVar.colorFillSecondary};
      color: ${cssVar.colorText};
    }
  `,
  questionsTitle: css`
    margin: 0;
    font-size: 13px;
    color: ${cssVar.colorTextDescription};
  `,
  title: css`
    font-size: 13px;
    font-weight: 600;
    color: ${cssVar.colorText};
  `,
  list: css`
    flex: 1;
    min-height: 0;
    width: 100%;
  `,
}))

interface ChatMessagesProps {
  agentMeta?: AgentMeta
  disabled?: boolean
  initialScrollToBottom?: boolean
  isStreaming?: boolean
  messages: UIMessage[]
  onDelete: (id: string) => void
  onEdit: (id: string, text: string) => void | Promise<void>
  onRegenerate: (id: string) => void
  onSelectOpeningQuestion?: (question: string) => void
  onToolApproval?: (toolCallId: string, toolName: string, args: Record<string, unknown>, approved: boolean) => void
  onServerToolApproval?: (approvalId: string, toolCallId: string, approved: boolean) => void
}

const ChatMessages = memo<ChatMessagesProps>(
  ({
    messages,
    agentMeta,
    disabled,
    initialScrollToBottom = false,
    isStreaming = false,
    onDelete,
    onEdit,
    onRegenerate,
    onSelectOpeningQuestion,
    onToolApproval,
    onServerToolApproval,
  }) => {
    const scrollbarRef = useRef<ScrollbarRef>(null)
    const wideScreen = useChatUiStore((state) => state.wideScreen)
    const lastMessage = messages.at(-1)
    const lastText = lastMessage ? getMessageText(lastMessage) : ''
    const lastReasoning = lastMessage ? getMessageReasoning(lastMessage) : ''
    const lastWebSearchStatus = lastMessage ? getWebSearchStatusSignature(lastMessage) : ''
    const lastAttachmentCount = lastMessage ? lastMessage.parts.filter((part) => part.type === 'file').length : 0

    const openingMessage = agentMeta?.openingMessage?.trim() || ''
    const openingQuestions = (agentMeta?.openingQuestions ?? []).filter((q) => q.trim().length > 0).slice(0, 5)

    const getScrollElement = useCallback(() => scrollbarRef.current?.wrapRef ?? null, [])
    const { handleScroll, resetScrollLock } = useAutoScroll<HTMLDivElement>({
      deps: [messages.length, lastText, lastReasoning, lastWebSearchStatus, lastAttachmentCount],
      enabled: isStreaming || disabled === true,
      getScrollElement,
      initialScrollToBottom,
    })

    // Unlock follow when a new user turn starts
    useEffect(() => {
      if (isStreaming) resetScrollLock()
    }, [isStreaming, resetScrollLock])

    if (messages.length === 0) {
      const hasWelcome = Boolean(openingMessage || openingQuestions.length > 0)

      return (
        <Scrollbar
          ref={scrollbarRef}
          className={styles.list}
          viewStyle={{ height: '100%', minHeight: '100%' }}
          onScroll={handleScroll}
        >
          <Flex
            className={[styles.content, 'flex-col-center gap-6']}
            style={{ width: wideScreen ? '100%' : `min(${CONVERSATION_MAX_WIDTH}px, 100%)` }}
          >
            {hasWelcome ? (
              <>
                {agentMeta ? (
                  <Flex className='flex-col-center gap-2'>
                    <Avatar avatar={agentMeta.avatar} size={48} />
                    <Text className={styles.title}>{agentMeta.title}</Text>
                  </Flex>
                ) : null}
                {openingMessage ? <Text className={styles.openingMessage}>{openingMessage}</Text> : null}
                {openingQuestions.length > 0 ? (
                  <Flex className='flex-col-center gap-2' style={{ maxWidth: 640, width: '100%' }}>
                    <p className={styles.questionsTitle}>试试这些问题</p>
                    <Flex className='flex-wrap justify-center gap-2'>
                      {openingQuestions.map((question) => (
                        <button
                          className={styles.questionChip}
                          disabled={disabled || !onSelectOpeningQuestion}
                          key={question}
                          type='button'
                          onClick={() => onSelectOpeningQuestion?.(question)}
                        >
                          {question}
                        </button>
                      ))}
                    </Flex>
                  </Flex>
                ) : null}
              </>
            ) : (
              <Text className={styles.empty}>开始对话吧</Text>
            )}
          </Flex>
        </Scrollbar>
      )
    }

    return (
      <Scrollbar ref={scrollbarRef} className={styles.list} viewStyle={{ minHeight: '100%' }} onScroll={handleScroll}>
        <Flex
          className={[styles.content, 'flex-col gap-4']}
          style={{ width: wideScreen ? '100%' : `min(${CONVERSATION_MAX_WIDTH}px, 100%)` }}
        >
          {messages.map((message, index) => {
            const streamingThis = isStreaming && index === messages.length - 1 && message.role === 'assistant'

            return (
              <ChatMessageItem
                agentMeta={agentMeta}
                isStreaming={streamingThis}
                key={message.id}
                message={message}
                onDelete={onDelete}
                onEdit={onEdit}
                onRegenerate={onRegenerate}
                onToolApproval={onToolApproval}
                onServerToolApproval={onServerToolApproval}
              />
            )
          })}
        </Flex>
      </Scrollbar>
    )
  }
)

ChatMessages.displayName = 'ChatMessages'

export default ChatMessages
