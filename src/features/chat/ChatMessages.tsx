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
  ModelIcon,
} from '@pure/ui'
import { Flex, Typography } from 'antd'
import { useApp } from '@/components/AntdStaticMethods'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { type UIMessage } from 'ai'
import { AtomIcon, Check, Copy, Edit, Loader2Icon, MoreHorizontal, RefreshCw, Trash, X } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import MessageMarkdown from '@/features/chat/MessageMarkdown'
import { getMessageReasoning, getMessageText } from '@/features/chat/messageText'
import { useAutoScroll } from '@/features/chat/useAutoScroll'

export interface AgentMeta {
  avatar: string
  title: string
}

type MessageMetadata = {
  model?: string
  provider?: string
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

    &:hover .chat-msg-actions,
    &:focus-within .chat-msg-actions {
      opacity: 1;
      pointer-events: auto;
    }
  `,
  editActions: css`
    margin-top: 8px;
  `,
  editArea: css`
    width: 100%;
    min-height: 88px;
    padding: 8px 10px;
    border: 1px solid ${cssVar.colorBorder};
    border-radius: 12px;
    outline: none;
    resize: vertical;
    background: ${cssVar.colorBgContainer};
    color: ${cssVar.colorText};
    font-size: 15px;
    line-height: 1.6;
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
    overflow-y: auto;
    flex: 1;
    width: 100%;
    padding-block: 16px 28px;
  `,
  markdown: css`
    font-size: 15px;
    line-height: 1.6;
    word-break: break-word;

    pre {
      margin-block: 8px;
    }
  `,
  meta: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-block-start: 8px;
    color: ${cssVar.colorTextQuaternary};
    font-size: 12px;
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
  duration: number | null
  isStreaming?: boolean
  text: string
}

const Thinking = memo<ThinkingProps>(({ text, isStreaming = false, duration }) => {
  const [open, setOpen] = useState(isStreaming)

  useEffect(() => {
    setOpen(isStreaming)
  }, [isStreaming])

  const label = isStreaming
    ? '深度思考中…'
    : duration !== null
      ? `已深度思考（用时 ${duration.toFixed(1)} 秒）`
      : '已深度思考'

  return (
    <Accordion
      expandedKeys={open ? ['thinking'] : []}
      gap={8}
      onExpandedChange={(keys) => setOpen(keys.length > 0)}
    >
      <AccordionItem
        itemKey='thinking'
        paddingBlock={4}
        paddingInline={4}
        title={
          <Flex align='center' gap={6}>
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
                icon={isStreaming ? Loader2Icon : AtomIcon}
                size={14}
                spin={isStreaming}
              />
            </Block>
            <span className={styles.thinkingLabel}>{label}</span>
          </Flex>
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
    const [draft, setDraft] = useState('')
    const text = getMessageText(message)
    const reasoning = getMessageReasoning(message)
    const isUser = message.role === 'user'
    const metadata = message.metadata as MessageMetadata | undefined
    const model = metadata?.model

    // Track reasoning duration for the purple "已深度思考 (用时 X 秒)" label.
    const reasoningStartRef = useRef<number | null>(null)
    const [reasoningDuration, setReasoningDuration] = useState<number | null>(null)

    useEffect(() => {
      if (reasoning && reasoningStartRef.current === null) {
        reasoningStartRef.current = Date.now()
      }
      if (!isStreaming && reasoning && reasoningStartRef.current !== null && reasoningDuration === null) {
        setReasoningDuration((Date.now() - reasoningStartRef.current) / 1000)
      }
    }, [reasoning, isStreaming, reasoningDuration])

    const handleCopy = useCallback(async () => {
      await copyToClipboard(text)
      antdMessage.success('已复制')
    }, [antdMessage, text])

    const handleEdit = useCallback(() => {
      setDraft(text)
      setEditing(true)
    }, [text])

    const handleDelete = useCallback(() => {
      onDelete(message.id)
    }, [message.id, onDelete])

    const handleRegenerate = useCallback(() => {
      onRegenerate(message.id)
    }, [message.id, onRegenerate])

    const handleSave = useCallback(async () => {
      const next = draft.trim()
      if (!next || next === text) {
        setEditing(false)
        return
      }
      await onEdit(message.id, next)
      setEditing(false)
    }, [draft, message.id, onEdit, text])

    const moreMenuItems = [
      { icon: Edit, key: 'edit', label: '编辑', onClick: handleEdit },
      { icon: Copy, key: 'copy', label: '复制', onClick: handleCopy },
      { type: 'divider' as const },
      { icon: RefreshCw, key: 'regenerate', label: '重新生成', onClick: handleRegenerate },
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

        <div className={cx(styles.bubble, isUser ? styles.user : styles.assistant)}>
          {editing ? (
            <Flex vertical gap={8}>
              <textarea
                autoFocus
                className={styles.editArea}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setEditing(false)
                    setDraft(text)
                  }
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault()
                    handleSave()
                  }
                }}
              />
              <Flex className={styles.editActions} gap={8} justify='flex-end'>
                <ActionIcon
                  icon={X}
                  size='small'
                  title='取消'
                  onClick={() => {
                    setEditing(false)
                    setDraft(text)
                  }}
                />
                <ActionIcon icon={Check} size='small' title='保存' onClick={handleSave} />
              </Flex>
            </Flex>
          ) : (
            <>
              {!isUser && reasoning ? (
                <Thinking duration={reasoningDuration} isStreaming={isStreaming} text={reasoning} />
              ) : null}

              {text ? (
                <MessageMarkdown
                  className={cx(styles.markdown, isUser && styles.userMarkdown)}
                  isStreaming={isStreaming}
                  text={text}
                />
              ) : isStreaming ? (
                <Typography.Text type='secondary'>…</Typography.Text>
              ) : null}

              {!isUser && model ? (
                <div className={styles.meta}>
                  <ModelIcon model={model} size={14} type='mono' />
                  <span>{model}</span>
                </div>
              ) : null}

              {!disabled && (
                <div
                  className={cx(
                    styles.actions,
                    isUser ? styles.actionsUser : styles.actionsAssistant,
                    'chat-msg-actions'
                  )}
                >
                  <Flex align='center' gap={2}>
                    <ActionIcon icon={RefreshCw} size='small' title='重新生成' onClick={handleRegenerate} />
                    <ActionIcon icon={Edit} size='small' title='编辑' onClick={handleEdit} />
                    <ActionIcon icon={Copy} size='small' title='复制' onClick={handleCopy} />
                    <DropdownMenu items={moreMenuItems} placement='bottomLeft'>
                      <button className={styles.moreTrigger} title='更多' type='button'>
                        <MoreHorizontal size={16} />
                      </button>
                    </DropdownMenu>
                  </Flex>
                </div>
              )}
            </>
          )}
        </div>
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
    const lastMessage = messages.at(-1)
    const lastText = lastMessage ? getMessageText(lastMessage) : ''
    const lastReasoning = lastMessage ? getMessageReasoning(lastMessage) : ''

    const { ref, handleScroll, resetScrollLock } = useAutoScroll<HTMLDivElement>({
      deps: [messages.length, lastText, lastReasoning],
      enabled: isStreaming || disabled === true,
    })

    // Unlock follow when a new user turn starts
    useEffect(() => {
      if (isStreaming) resetScrollLock()
    }, [isStreaming, resetScrollLock])

    if (messages.length === 0) {
      return (
        <Flex vertical ref={ref} className={styles.list} align='center' justify='center'>
          <Typography.Text className={styles.empty}>开始对话吧</Typography.Text>
        </Flex>
      )
    }

    return (
      <Flex vertical ref={ref} className={styles.list} gap={16} onScroll={handleScroll}>
        {messages.map((message, index) => {
          const streamingThis =
            isStreaming && index === messages.length - 1 && message.role === 'assistant'

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
      </Flex>
    )
  }
)

ChatMessages.displayName = 'ChatMessages'

export default ChatMessages
