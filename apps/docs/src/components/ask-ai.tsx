'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { LoaderCircle, MessageCircle, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import Markdown from 'react-markdown'
import type { AskAIModelId, AskAISkillId } from '@/lib/ask-ai-config'
import { DEFAULT_ASK_AI_MODEL } from '@/lib/ask-ai-config'
import {
  getAskAIBusyLabel,
  hasPendingSearchDocs,
  hasVisibleAskAIText,
  loadAskAIMessages,
  saveAskAIMessages,
  toDocsRelativeHref,
} from '@/lib/ask-ai-session'
import { AIAgentInput } from './ai-agent-input'

const suggestions = ['如何快速开始？', '如何使用 Docker 部署？', '在线搜索需要配置什么？']

function DocsMarkdownLink({ href, children, ...props }: ComponentProps<'a'>) {
  return (
    <a href={href ? toDocsRelativeHref(href) : href} {...props}>
      {children}
    </a>
  )
}

export function AskAI() {
  const pathname = usePathname()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const lastRequestRef = useRef<{ model: AskAIModelId; skills: AskAISkillId[] }>({
    model: DEFAULT_ASK_AI_MODEL,
    skills: [],
  })
  const [composerResetKey, setComposerResetKey] = useState(0)
  const [open, setOpen] = useState(false)
  const [restored, setRestored] = useState(false)
  const [selectedModel, setSelectedModel] = useState<AskAIModelId>(DEFAULT_ASK_AI_MODEL)
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/chat', body: { page: pathname } }), [pathname])
  const { clearError, error, messages, regenerate, sendMessage, setMessages, status, stop } = useChat({ transport })
  const pending = status === 'submitted' || status === 'streaming'
  const lastMessage = messages.at(-1)
  const lastAssistant = lastMessage?.role === 'assistant' ? lastMessage : undefined
  const busyLabel = error
    ? null
    : getAskAIBusyLabel({
        hasPendingSearch: lastAssistant ? hasPendingSearchDocs(lastAssistant) : false,
        hasVisibleText: lastAssistant ? hasVisibleAskAIText(lastAssistant) : false,
        status,
      })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    let cancelled = false

    void loadAskAIMessages().then((stored) => {
      if (cancelled) return
      if (stored.length > 0) setMessages(stored)
      setRestored(true)
    })

    return () => {
      cancelled = true
    }
  }, [setMessages])

  useEffect(() => {
    if (!restored) return
    saveAskAIMessages(messages)
  }, [messages, restored])

  function submit(text: string, skills: AskAISkillId[] = []) {
    const value = text.trim()
    if (!value || pending || value.length > 1000) return
    const requestContext = { model: selectedModel, skills }
    lastRequestRef.current = requestContext
    clearError()
    void sendMessage({ text: value }, { body: requestContext })
  }

  function submitSuggestion(text: string) {
    submit(text)
    setComposerResetKey((key) => key + 1)
  }

  function clearConversation() {
    stop()
    clearError()
    setMessages([])
    setComposerResetKey((key) => key + 1)
  }

  return (
    <>
      <button aria-label='打开文档助手' className='docs-ai-trigger' onClick={() => setOpen(true)} type='button'>
        <MessageCircle aria-hidden className='size-4' />
        问问文档
      </button>

      <dialog
        aria-labelledby='docs-ai-title'
        className='docs-ai-dialog'
        onCancel={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}
        onClose={() => setOpen(false)}
        ref={dialogRef}
      >
        <div className='docs-ai-panel'>
          <header className='docs-ai-header'>
            <div className='docs-ai-brand'>
              <span aria-hidden className='docs-ai-brand-mark'>
                <MessageCircle className='size-4' />
              </span>
              <div className='min-w-0'>
                <h2 className='docs-ai-title' id='docs-ai-title'>
                  问问文档
                </h2>
                <p className='docs-ai-eyebrow'>基于公开文档回答</p>
              </div>
            </div>
            <div className='flex items-center gap-0.5'>
              <button aria-label='清空对话' className='docs-ai-icon' onClick={clearConversation} type='button'>
                <Trash2 aria-hidden className='size-4' />
              </button>
              <button aria-label='关闭文档助手' className='docs-ai-icon' onClick={() => setOpen(false)} type='button'>
                <X aria-hidden className='size-4' />
              </button>
            </div>
          </header>

          <div aria-live='polite' className='docs-ai-messages'>
            {restored && messages.length === 0 ? (
              <div className='docs-ai-empty'>
                <span className='docs-ai-empty-icon'>
                  <Search aria-hidden className='size-5' />
                </span>
                <h3>询问 PureChat 文档</h3>
                <p>回答只依据当前公开文档，并附上可继续阅读的来源。</p>
                <div className='grid gap-2 pt-2'>
                  {suggestions.map((suggestion) => (
                    <button
                      className='docs-ai-suggestion'
                      key={suggestion}
                      onClick={() => submitSuggestion(suggestion)}
                      type='button'
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {restored
              ? messages.map((message) => {
                  if (message.role === 'assistant' && !hasVisibleAskAIText(message)) return null

                  return (
                    <article className='docs-ai-message' data-role={message.role} key={message.id}>
                      {message.parts.map((part, index) => {
                        if (part.type !== 'text' || !part.text.trim()) return null

                        return (
                          <div className='docs-ai-markdown' key={`${message.id}-text-${index}`}>
                            <Markdown components={{ a: DocsMarkdownLink }}>{part.text}</Markdown>
                          </div>
                        )
                      })}
                    </article>
                  )
                })
              : null}

            {busyLabel ? (
              <p className='docs-ai-tool'>
                <LoaderCircle aria-hidden className='size-3.5 animate-spin' />
                {busyLabel}
              </p>
            ) : null}

            {error ? (
              <div className='docs-ai-error' role='alert'>
                <span>{error.message || '文档助手暂时无法回答，请稍后重试。'}</span>
                <button onClick={() => void regenerate({ body: lastRequestRef.current })} type='button'>
                  <RotateCcw aria-hidden className='size-3.5' />
                  重试
                </button>
              </div>
            ) : null}
          </div>

          <AIAgentInput
            model={selectedModel}
            onModelChange={setSelectedModel}
            onStop={stop}
            onSubmit={({ skills, text }) => submit(text, skills)}
            pending={pending}
            resetKey={composerResetKey}
          />
        </div>
      </dialog>
    </>
  )
}
