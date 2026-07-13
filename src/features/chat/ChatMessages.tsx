'use client'

import type { ActionIconGroupEvent, ActionIconGroupItemType } from '@lobehub/ui'
import { ActionIcon, ActionIconGroup, Flexbox, Text, copyToClipboard } from '@lobehub/ui'
import { App } from 'antd'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import type { UIMessage } from 'ai'
import { Check, Copy, Edit, Trash, X } from 'lucide-react'
import { memo, useCallback, useEffect, useState } from 'react'

import MessageMarkdown from '@/features/chat/MessageMarkdown'
import { getMessageText } from '@/features/chat/messageText'
import { useAutoScroll } from '@/features/chat/useAutoScroll'

const styles = createStaticStyles(({ css }) => ({
  actions: css`
    position: absolute;
    z-index: 1;
    inset-block-end: -10px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease;
  `,
  actionsAssistant: css`
    inset-inline-start: 0;
  `,
  actionsUser: css`
    inset-inline-end: 0;
  `,
  assistant: css`
    align-self: flex-start;
    max-width: 85%;
    padding: 10px 14px;
    border-radius: 16px;
    background: ${cssVar.colorFillTertiary};
    color: ${cssVar.colorText};
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
  row: css`
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    margin-block-end: 8px;
  `,
  user: css`
    align-self: flex-end;
    max-width: 85%;
    padding: 10px 14px;
    border-radius: 16px;
    background: ${cssVar.colorText};
    color: ${cssVar.colorBgContainer};

    a {
      color: ${cssVar.colorBgContainer};
      text-decoration: underline;
    }

    code {
      background: rgba(255, 255, 255, 0.16);
    }
  `,
  userMarkdown: css`
    color: inherit;
  `,
}))

const ACTION_ITEMS: ActionIconGroupItemType[] = [
  { icon: Copy, key: 'copy', label: '复制' },
  { icon: Edit, key: 'edit', label: '编辑' },
  { danger: true, icon: Trash, key: 'delete', label: '删除' },
]

interface ChatMessageItemProps {
  disabled?: boolean
  isStreaming?: boolean
  message: UIMessage
  onDelete: (id: string) => void
  onEdit: (id: string, text: string) => void | Promise<void>
}

const ChatMessageItem = memo<ChatMessageItemProps>(
  ({ message, disabled, isStreaming, onDelete, onEdit }) => {
    const { message: antdMessage } = App.useApp()
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState('')
    const text = getMessageText(message)
    const isUser = message.role === 'user'

    const handleAction = useCallback(
      async (event: ActionIconGroupEvent) => {
        if (disabled) return

        switch (event.key) {
          case 'copy': {
            await copyToClipboard(text)
            antdMessage.success('已复制')
            break
          }
          case 'edit': {
            setDraft(text)
            setEditing(true)
            break
          }
          case 'delete': {
            onDelete(message.id)
            break
          }
          default: {
            break
          }
        }
      },
      [antdMessage, disabled, message.id, onDelete, text],
    )

    const handleSave = useCallback(async () => {
      const next = draft.trim()
      if (!next || next === text) {
        setEditing(false)
        return
      }
      await onEdit(message.id, next)
      setEditing(false)
    }, [draft, message.id, onEdit, text])

    if (!text && !isStreaming) return null

    return (
      <div className={styles.row} data-role={message.role}>
        <div className={cx(styles.bubble, isUser ? styles.user : styles.assistant)}>
          {editing ? (
            <Flexbox gap={8}>
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
                    void handleSave()
                  }
                }}
              />
              <Flexbox className={styles.editActions} horizontal gap={8} justify='flex-end'>
                <ActionIcon
                  icon={X}
                  size='small'
                  title='取消'
                  onClick={() => {
                    setEditing(false)
                    setDraft(text)
                  }}
                />
                <ActionIcon
                  icon={Check}
                  size='small'
                  title='保存'
                  onClick={() => void handleSave()}
                />
              </Flexbox>
            </Flexbox>
          ) : (
            <>
              {text ? (
                <MessageMarkdown
                  className={cx(styles.markdown, isUser && styles.userMarkdown)}
                  isStreaming={isStreaming}
                  text={text}
                />
              ) : (
                <Text type='secondary'>…</Text>
              )}

              {!disabled && (
                <div
                  className={cx(
                    styles.actions,
                    isUser ? styles.actionsUser : styles.actionsAssistant,
                    'chat-msg-actions',
                  )}
                >
                  <ActionIconGroup
                    items={ACTION_ITEMS}
                    size='small'
                    variant='outlined'
                    onActionClick={(event) => void handleAction(event)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  },
  // Compare message by reference. AI SDK mutates the live streaming message
  // in place before replaceMessage snapshots it — content-based compare via
  // getMessageText(prev) already sees the new text, so memo would skip and
  // leave the bubble stuck on "…".
  (prev, next) =>
    prev.disabled === next.disabled &&
    prev.isStreaming === next.isStreaming &&
    prev.message === next.message &&
    prev.onDelete === next.onDelete &&
    prev.onEdit === next.onEdit,
)

ChatMessageItem.displayName = 'ChatMessageItem'

interface ChatMessagesProps {
  disabled?: boolean
  isStreaming?: boolean
  messages: UIMessage[]
  onDelete: (id: string) => void
  onEdit: (id: string, text: string) => void | Promise<void>
}

const ChatMessages = memo<ChatMessagesProps>(
  ({ messages, disabled, isStreaming = false, onDelete, onEdit }) => {
    const lastMessage = messages.at(-1)
    const lastText = lastMessage ? getMessageText(lastMessage) : ''

    const { ref, handleScroll, resetScrollLock } = useAutoScroll<HTMLDivElement>({
      deps: [messages.length, lastText],
      enabled: isStreaming || disabled === true,
    })

    // Unlock follow when a new user turn starts
    useEffect(() => {
      if (isStreaming) resetScrollLock()
    }, [isStreaming, resetScrollLock])

    if (messages.length === 0) {
      return (
        <Flexbox ref={ref} className={styles.list} align='center' justify='center'>
          <Text className={styles.empty}>开始对话吧</Text>
        </Flexbox>
      )
    }

    return (
      <Flexbox ref={ref} className={styles.list} gap={16} onScroll={handleScroll}>
        {messages.map((message, index) => {
          const streamingThis =
            isStreaming && index === messages.length - 1 && message.role === 'assistant'

          return (
            <ChatMessageItem
              key={message.id}
              disabled={disabled}
              isStreaming={streamingThis}
              message={message}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          )
        })}
      </Flexbox>
    )
  },
)

ChatMessages.displayName = 'ChatMessages'

export default ChatMessages
