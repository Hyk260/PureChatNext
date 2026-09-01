'use client'

import { ApprovalCard, Avatar, copyToClipboard, Text, Flex } from '@pure/ui'
import type { ChatMessageMetadata } from '@pure/types'
import { useApp } from '@/components/AntdStaticMethods'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import type { UIMessage } from 'ai'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import Scrollbar from '@/components/Scrollbar'
import type { ScrollbarRef } from '@/components/Scrollbar'
import { PulseDots } from '@/components/Loading'
import MessageActions from '@/features/chat/MessageActions'
import MessageAttachments from '@/features/chat/MessageAttachments'
import MessageEditorModal from '@/features/chat/MessageEditorModal'
import MessageMarkdown from '@/features/chat/MessageMarkdown'
import MessageUsage from '@/features/chat/MessageUsage'
import Thinking from '@/features/chat/Thinking'
import { getMessageReasoning, getMessageText } from '@/features/chat/messageText'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import { useAutoScroll } from '@/features/chat/useAutoScroll'
import WebSearchStatus, { getWebSearchStatusSignature, hasWebSearchToolPart } from '@/features/chat/WebSearchStatus'
import { getToolApprovalTitle } from '@/features/chat/localTools'
import { getToolApprovalItems } from '@/features/chat/toolApprovalParts'
import type { ToolApprovalItem } from '@/features/chat/toolApprovalParts'
import { CONVERSATION_MAX_WIDTH } from '@/features/chat/WideScreenContainer'

export interface AgentMeta {
  avatar: string
  title: string
}

const styles = createStaticStyles(({ css }) => ({
  assistant: css`
    align-self: flex-start;
    width: 100%;
    max-width: 100%;
  `,
  bubble: css`
    position: relative;
  `,
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
  header: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-block-end: 6px;
  `,
  list: css`
    flex: 1;
    min-height: 0;
    width: 100%;
  `,
  markdown: css`
    font-size: 15px;
    line-height: 1.6;
    word-break: break-word;

    pre {
      margin-block: 8px;
    }
  `,
  row: css`
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    margin-block-end: 8px;
  `,
  title: css`
    font-size: 13px;
    font-weight: 600;
    color: ${cssVar.colorText};
  `,
  user: css`
    align-self: flex-end;
    max-width: 85%;
    padding: 10px 14px;
    border-radius: 16px;
    background: ${cssVar.colorFillTertiary};
    color: ${cssVar.colorText};
  `,
  userMarkdown: css`
    color: inherit;
  `,
}))

interface ChatMessageItemProps {
  agentMeta?: AgentMeta
  isStreaming?: boolean
  message: UIMessage
  onDelete: (id: string) => void
  onEdit: (id: string, text: string) => void | Promise<void>
  onRegenerate: (id: string) => void
  onToolApproval?: (toolCallId: string, toolName: string, args: Record<string, unknown>, approved: boolean) => void
  onServerToolApproval?: (approvalId: string, toolCallId: string, approved: boolean) => void
}

const formatApprovalCommand = (args: Record<string, unknown>) => {
  if (typeof args.command === 'string') return args.command
  return Object.entries(args)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join('\n')
}

const getApprovalCwd = (args: Record<string, unknown>) => {
  if (typeof args.cwd === 'string') return args.cwd
  if (typeof args.path === 'string') return args.path
  return ''
}

const applyToolApprovalDecision = (
  item: ToolApprovalItem,
  approved: boolean,
  onToolApproval?: ChatMessageItemProps['onToolApproval'],
  onServerToolApproval?: ChatMessageItemProps['onServerToolApproval']
) => {
  if (item.kind === 'local') {
    onToolApproval?.(item.toolCallId, item.toolName, item.args, approved)
    return
  }
  if (item.approvalId) onServerToolApproval?.(item.approvalId, item.toolCallId, approved)
}

const ChatMessageItem = memo<ChatMessageItemProps>(
  ({ message, agentMeta, isStreaming, onDelete, onEdit, onRegenerate, onServerToolApproval, onToolApproval }) => {
    const { message: antdMessage } = useApp()
    const [editing, setEditing] = useState(false)
    const text = getMessageText(message)
    const reasoning = getMessageReasoning(message)
    const hasWebSearch = hasWebSearchToolPart(message)
    const isUser = message.role === 'user'
    const metadata = message.metadata as ChatMessageMetadata | undefined
    const isReasoning =
      isStreaming && message.parts.some((part) => part.type === 'reasoning' && part.state === 'streaming')

    const handleCopy = useCallback(async () => {
      await copyToClipboard(text)
      antdMessage.success('已复制')
    }, [antdMessage, text])

    const handleEdit = useCallback(() => {
      setEditing(true)
    }, [])

    const handleDelete = useCallback(() => {
      onDelete(message.id)
    }, [message.id, onDelete])

    const hasAttachments = message.parts.some((part) => part.type === 'file')
    const approvalItems = getToolApprovalItems(message.parts)

    if (!text && !reasoning && !hasWebSearch && !hasAttachments && approvalItems.length === 0 && !isStreaming) {
      return null
    }

    return (
      <div className={styles.row} data-role={message.role}>
        {!isUser && agentMeta ? (
          <div className={styles.header}>
            <Avatar avatar={agentMeta.avatar} background={cssVar.colorFillSecondary} size={28} />
            <span className={styles.title}>{agentMeta.title}</span>
          </div>
        ) : null}

        <div className={cx(styles.bubble, isUser ? styles.user : styles.assistant)} data-message-content>
          {!isUser && hasWebSearch ? <WebSearchStatus message={message} /> : null}

          {!isUser && reasoning ? (
            <Thinking duration={metadata?.reasoning?.duration} text={reasoning} thinking={isReasoning} />
          ) : null}

          <MessageAttachments message={message} />

          {approvalItems.map((item) => (
            <ApprovalCard
              key={`${item.kind}-${item.toolCallId}`}
              variant='command'
              title={getToolApprovalTitle(item.toolName)}
              command={formatApprovalCommand(item.args)}
              cwd={getApprovalCwd(item.args)}
              approveLabel='批准'
              rejectLabel='拒绝'
              onApprove={() => applyToolApprovalDecision(item, true, onToolApproval, onServerToolApproval)}
              onReject={() => applyToolApprovalDecision(item, false, onToolApproval, onServerToolApproval)}
            />
          ))}

          {text ? (
            <MessageMarkdown
              className={cx(styles.markdown, isUser && styles.userMarkdown)}
              isStreaming={isStreaming}
              text={text}
            />
          ) : isStreaming && !reasoning && !hasWebSearch ? (
            <PulseDots />
          ) : null}
        </div>

        {!isUser && (metadata || isStreaming) ? <MessageUsage isStreaming={isStreaming} metadata={metadata} /> : null}

        <MessageActions
          isStreaming={isStreaming}
          isUser={isUser}
          onCopy={handleCopy}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
        <MessageEditorModal
          open={editing}
          value={text}
          onCancel={() => setEditing(false)}
          onSubmit={(next) => onEdit(message.id, next)}
        />
      </div>
    )
  },
  (prev, next) =>
    prev.isStreaming === next.isStreaming &&
    prev.message === next.message &&
    prev.onDelete === next.onDelete &&
    prev.onEdit === next.onEdit &&
    prev.onRegenerate === next.onRegenerate &&
    prev.onToolApproval === next.onToolApproval &&
    prev.onServerToolApproval === next.onServerToolApproval &&
    prev.agentMeta === next.agentMeta
)

ChatMessageItem.displayName = 'ChatMessageItem'

interface ChatMessagesProps {
  agentMeta?: AgentMeta
  disabled?: boolean
  initialScrollToBottom?: boolean
  isStreaming?: boolean
  messages: UIMessage[]
  onDelete: (id: string) => void
  onEdit: (id: string, text: string) => void | Promise<void>
  onRegenerate: (id: string) => void
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
      return (
        <Scrollbar
          ref={scrollbarRef}
          className={styles.list}
          viewStyle={{ height: '100%', minHeight: '100%' }}
          onScroll={handleScroll}
        >
          <Flex
            className={[styles.content, 'flex-col-center']}

            style={{ width: wideScreen ? '100%' : `min(${CONVERSATION_MAX_WIDTH}px, 100%)` }}
          >
            <Text className={styles.empty}>开始对话吧</Text>
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
