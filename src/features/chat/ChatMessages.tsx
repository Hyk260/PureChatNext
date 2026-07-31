'use client'

import {
  Accordion,
  AccordionItem,
  ActionIcon,
  Avatar,
  Block,
  copyToClipboard,
  DropdownMenu,
  Icon,
  Text,
  Flexbox,
} from '@pure/ui'
import type { ChatMessageMetadata } from '@pure/types'
import { useApp } from '@/components/AntdStaticMethods'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import type { UIMessage } from 'ai'
import { AtomIcon, Copy, Edit, Loader2Icon, MoreHorizontal, RefreshCw, Trash } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import Scrollbar from '@/components/Scrollbar'
import type { ScrollbarRef } from '@/components/Scrollbar'
import { PulseDots } from '@/components/Loading'
import MessageEditorModal from '@/features/chat/MessageEditorModal'
import MessageUsage from '@/features/chat/MessageUsage'
import MessageMarkdown from '@/features/chat/MessageMarkdown'
import { getMessageReasoning, getMessageText } from '@/features/chat/messageText'
import { useChatUiStore } from '@/features/chat/store/useChatUiStore'
import { useAutoScroll } from '@/features/chat/useAutoScroll'
import { CONVERSATION_MAX_WIDTH } from '@/features/chat/WideScreenContainer'

export interface AgentMeta {
  avatar: string
  title: string
}

const styles = createStaticStyles(({ css }) => ({
  actions: css`
    display: flex;
    margin-block-start: 4px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease;
  `,
  actionsAssistant: css`
    justify-content: flex-start;
  `,
  actionsUser: css`
    justify-content: flex-end;
  `,
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
  moreTrigger: css`
    cursor: pointer;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 6px;

    color: ${cssVar.colorTextSecondary};
    background: transparent;
    outline: none;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }
  `,
  row: css`
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    margin-block-end: 8px;

    &:hover .chat-msg-actions,
    &:focus-within .chat-msg-actions {
      opacity: 1;
      pointer-events: auto;
    }
  `,
  thinkingBody: css`
    color: ${cssVar.colorTextDescription};
    font-size: 13px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
  `,
  thinkingLabel: css`
    color: ${cssVar.colorTextSecondary};
    font-size: 12px;
    user-select: none;
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

interface ThinkingProps {
  duration?: number
  thinking?: boolean
  text: string
}

const Thinking = memo<ThinkingProps>(({ text, thinking = false, duration }) => {
  const [open, setOpen] = useState(thinking)

  useEffect(() => {
    setOpen(thinking)
  }, [thinking])

  const label = thinking
    ? '深度思考中…'
    : duration !== undefined
      ? `已深度思考（用时 ${(duration / 1000).toFixed(1)} 秒）`
      : '已深度思考'

  return (
    <Accordion expandedKeys={open ? ['thinking'] : []} gap={8} onExpandedChange={(keys) => setOpen(keys.length > 0)}>
      <AccordionItem
        itemKey='thinking'
        paddingBlock={4}
        paddingInline={4}
        title={
          <Flexbox horizontal align='center' gap={6}>
            <Block
              align='center'
              flex='none'
              gap={4}
              height={24}
              horizontal
              justify='center'
              style={{ fontSize: 12 }}
              variant='outlined'
              width={24}
            >
              <Icon
                color={cssVar.colorTextDescription}
                icon={thinking ? Loader2Icon : AtomIcon}
                size={14}
                spin={thinking}
              />
            </Block>
            <span className={styles.thinkingLabel}>{label}</span>
          </Flexbox>
        }
      >
        <div className={styles.thinkingBody}>{text}</div>
      </AccordionItem>
    </Accordion>
  )
})

Thinking.displayName = 'Thinking'

interface ChatMessageItemProps {
  agentMeta?: AgentMeta
  disabled?: boolean
  isStreaming?: boolean
  message: UIMessage
  onDelete: (id: string) => void
  onEdit: (id: string, text: string) => void | Promise<void>
  onRegenerate: (id: string) => void
}

const ChatMessageItem = memo<ChatMessageItemProps>(
  ({ message, agentMeta, disabled, isStreaming, onDelete, onEdit, onRegenerate }) => {
    const { message: antdMessage } = useApp()
    const [editing, setEditing] = useState(false)
    const text = getMessageText(message)
    const reasoning = getMessageReasoning(message)
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

    const handleRegenerate = useCallback(() => {
      onRegenerate(message.id)
    }, [message.id, onRegenerate])

    const moreMenuItems = [
      { icon: Edit, key: 'edit', label: '编辑', onClick: handleEdit },
      { icon: Copy, key: 'copy', label: '复制', onClick: handleCopy },
      { type: 'divider' as const },
      // { icon: RefreshCw, key: 'regenerate', label: '重新生成', onClick: handleRegenerate },
      { danger: true, icon: Trash, key: 'delete', label: '删除', onClick: handleDelete },
    ]

    if (!text && !reasoning && !isStreaming) return null

    return (
      <div className={styles.row} data-role={message.role}>
        {!isUser && agentMeta ? (
          <div className={styles.header}>
            <Avatar avatar={agentMeta.avatar} background={cssVar.colorFillSecondary} size={28} />
            <span className={styles.title}>{agentMeta.title}</span>
          </div>
        ) : null}

        <div className={cx(styles.bubble, isUser ? styles.user : styles.assistant)} data-message-content>
          {!isUser && reasoning ? (
            <Thinking duration={metadata?.reasoning?.duration} text={reasoning} thinking={isReasoning} />
          ) : null}

          {text ? (
            <MessageMarkdown
              className={cx(styles.markdown, isUser && styles.userMarkdown)}
              isStreaming={isStreaming}
              text={text}
            />
          ) : isStreaming && !reasoning ? (
            <PulseDots />
          ) : null}
        </div>

        {!isUser && metadata ? <MessageUsage metadata={metadata} /> : null}

        {!disabled ? (
          <div
            className={cx(styles.actions, isUser ? styles.actionsUser : styles.actionsAssistant, 'chat-msg-actions')}
            data-message-actions
          >
            <Flexbox horizontal align='center' gap={2}>
              {/* <ActionIcon icon={RefreshCw} size='small' title='重新生成' onClick={handleRegenerate} /> */}
              <ActionIcon icon={Edit} size='small' title='编辑' onClick={handleEdit} />
              <ActionIcon icon={Copy} size='small' title='复制' onClick={handleCopy} />
              <DropdownMenu items={moreMenuItems} placement={isUser ? 'bottomRight' : 'bottomLeft'}>
                <button className={styles.moreTrigger} title='更多' type='button'>
                  <MoreHorizontal size={16} />
                </button>
              </DropdownMenu>
            </Flexbox>
          </div>
        ) : null}
        <MessageEditorModal
          isUser={isUser}
          open={editing}
          value={text}
          onCancel={() => setEditing(false)}
          onSubmit={(next) => onEdit(message.id, next)}
        />
      </div>
    )
  },
  (prev, next) =>
    prev.disabled === next.disabled &&
    prev.isStreaming === next.isStreaming &&
    prev.message === next.message &&
    prev.onDelete === next.onDelete &&
    prev.onEdit === next.onEdit &&
    prev.onRegenerate === next.onRegenerate &&
    prev.agentMeta === next.agentMeta
)

ChatMessageItem.displayName = 'ChatMessageItem'

interface ChatMessagesProps {
  agentMeta?: AgentMeta
  disabled?: boolean
  isStreaming?: boolean
  messages: UIMessage[]
  onDelete: (id: string) => void
  onEdit: (id: string, text: string) => void | Promise<void>
  onRegenerate: (id: string) => void
}

const ChatMessages = memo<ChatMessagesProps>(
  ({ messages, agentMeta, disabled, isStreaming = false, onDelete, onEdit, onRegenerate }) => {
    const scrollbarRef = useRef<ScrollbarRef>(null)
    const wideScreen = useChatUiStore((state) => state.wideScreen)
    const lastMessage = messages.at(-1)
    const lastText = lastMessage ? getMessageText(lastMessage) : ''
    const lastReasoning = lastMessage ? getMessageReasoning(lastMessage) : ''

    const getScrollElement = useCallback(() => scrollbarRef.current?.wrapRef ?? null, [])
    const { handleScroll, resetScrollLock } = useAutoScroll<HTMLDivElement>({
      deps: [messages.length, lastText, lastReasoning],
      enabled: isStreaming || disabled === true,
      getScrollElement,
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
          <Flexbox
            align='center'
            className={styles.content}
            justify='center'
            style={{ width: wideScreen ? '100%' : `min(${CONVERSATION_MAX_WIDTH}px, 100%)` }}
          >
            <Text className={styles.empty}>开始对话吧</Text>
          </Flexbox>
        </Scrollbar>
      )
    }

    return (
      <Scrollbar ref={scrollbarRef} className={styles.list} viewStyle={{ minHeight: '100%' }} onScroll={handleScroll}>
        <Flexbox
          className={styles.content}
          gap={16}
          style={{ width: wideScreen ? '100%' : `min(${CONVERSATION_MAX_WIDTH}px, 100%)` }}
        >
          {messages.map((message, index) => {
            const streamingThis = isStreaming && index === messages.length - 1 && message.role === 'assistant'

            return (
              <ChatMessageItem
                agentMeta={agentMeta}
                disabled={disabled}
                isStreaming={streamingThis}
                key={message.id}
                message={message}
                onDelete={onDelete}
                onEdit={onEdit}
                onRegenerate={onRegenerate}
              />
            )
          })}
        </Flexbox>
      </Scrollbar>
    )
  }
)

ChatMessages.displayName = 'ChatMessages'

export default ChatMessages
