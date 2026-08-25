'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { LoaderCircle, MessageCircle, RotateCcw, Search, Send, Square, Trash2, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import Markdown from 'react-markdown'

const suggestions = ['如何快速开始？', '如何使用 Docker 部署？', '在线搜索需要配置什么？']

export function AskAI() {
  const pathname = usePathname()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat', body: { page: pathname } }),
    [pathname],
  )
  const { clearError, error, messages, regenerate, sendMessage, setMessages, status, stop } = useChat({ transport })
  const pending = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function submit(text: string) {
    const value = text.trim()
    if (!value || pending || value.length > 1000) return
    clearError()
    void sendMessage({ text: value })
    setInput('')
  }

  function clearConversation() {
    stop()
    clearError()
    setMessages([])
    setInput('')
  }

  return (
    <>
      <button aria-label='打开 Ask AI' className='docs-ai-trigger' onClick={() => setOpen(true)} type='button'>
        <MessageCircle aria-hidden className='size-4' />
        Ask AI
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
            <div>
              <p className='docs-ai-eyebrow'>PURECHAT DOCS</p>
              <h2 className='docs-ai-title' id='docs-ai-title'>
                Ask AI
              </h2>
            </div>
            <div className='flex items-center gap-1'>
              <button aria-label='清空对话' className='docs-ai-icon' onClick={clearConversation} type='button'>
                <Trash2 aria-hidden className='size-4' />
              </button>
              <button aria-label='关闭 Ask AI' className='docs-ai-icon' onClick={() => setOpen(false)} type='button'>
                <X aria-hidden className='size-4' />
              </button>
            </div>
          </header>

          <div aria-live='polite' className='docs-ai-messages'>
            {messages.length === 0 ? (
              <div className='docs-ai-empty'>
                <span className='docs-ai-empty-icon'>
                  <Search aria-hidden className='size-5' />
                </span>
                <h3>询问 PureChat 文档</h3>
                <p>回答只依据当前公开文档，并附上可继续阅读的来源。</p>
                <div className='grid gap-2 pt-2'>
                  {suggestions.map((suggestion) => (
                    <button className='docs-ai-suggestion' key={suggestion} onClick={() => submit(suggestion)} type='button'>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <article className='docs-ai-message' data-role={message.role} key={message.id}>
                  <p className='docs-ai-message-role'>{message.role === 'user' ? '你' : 'PureChat AI'}</p>
                  {message.parts.map((part, index) => {
                    if (part.type === 'text') {
                      return (
                        <div className='docs-ai-markdown' key={`${message.id}-text-${index}`}>
                          <Markdown>{part.text}</Markdown>
                        </div>
                      )
                    }

                    if (part.type === 'tool-searchDocs' && part.state !== 'output-available') {
                      return (
                        <p className='docs-ai-tool' key={part.toolCallId}>
                          <LoaderCircle aria-hidden className='size-3.5 animate-spin' />
                          正在检索文档…
                        </p>
                      )
                    }

                    return null
                  })}
                </article>
              ))
            )}

            {status === 'submitted' ? (
              <p className='docs-ai-tool'>
                <LoaderCircle aria-hidden className='size-3.5 animate-spin' />
                正在思考…
              </p>
            ) : null}

            {error ? (
              <div className='docs-ai-error' role='alert'>
                <span>Ask AI 暂时无法回答，请稍后重试。</span>
                <button onClick={() => void regenerate()} type='button'>
                  <RotateCcw aria-hidden className='size-3.5' />
                  重试
                </button>
              </div>
            ) : null}
          </div>

          <form
            className='docs-ai-composer'
            onSubmit={(event) => {
              event.preventDefault()
              submit(input)
            }}
          >
            <textarea
              aria-label='向 PureChat 文档提问'
              disabled={pending}
              maxLength={1000}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  submit(input)
                }
              }}
              placeholder='询问安装、部署或开发问题…'
              rows={3}
              value={input}
            />
            <div className='docs-ai-composer-footer'>
              <span>{input.length}/1000</span>
              {pending ? (
                <button aria-label='停止生成' onClick={stop} type='button'>
                  <Square aria-hidden className='size-3.5 fill-current' />
                </button>
              ) : (
                <button aria-label='发送问题' disabled={!input.trim()} type='submit'>
                  <Send aria-hidden className='size-4' />
                </button>
              )}
            </div>
          </form>
        </div>
      </dialog>
    </>
  )
}
