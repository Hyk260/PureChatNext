'use client'

import { ActionIcon, Block, Flexbox } from '@lobehub/ui'
import { App } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { ArrowUp, Plus } from 'lucide-react'
import { memo, useCallback, useState } from 'react'

import AgentModeButton from '@/features/home/components/AgentModeButton'
import ModelSelector from '@/features/home/components/ModelSelector'
import { useHomeStore } from '@/features/home/store/useHomeStore'

const styles = createStaticStyles(({ css }) => ({
  input: css`
    width: 100%;
    min-height: 88px;
    padding: 0;
    border: none;
    outline: none;
    resize: none;
    background: transparent;
    color: ${cssVar.colorText};
    font-size: 15px;
    line-height: 1.6;

    &::placeholder {
      color: ${cssVar.colorTextQuaternary};
    }
  `,
  send: css`
    background: ${cssVar.colorText} !important;
    color: ${cssVar.colorBgContainer} !important;
    border-radius: 50%;
  `,
  shell: css`
    border-radius: 20px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.04);
  `,
}))

const HomeChatInput = memo(() => {
  const { message } = App.useApp()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const selectedModel = useHomeStore((s) => s.selectedModel)
  const selectedProvider = useHomeStore((s) => s.selectedProvider)
  const selectedAgentId = useHomeStore((s) => s.selectedAgentId)
  const agentMode = useHomeStore((s) => s.agentMode)

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return

    const payload = {
      agentId: selectedAgentId,
      agentMode,
      model: selectedModel,
      provider: selectedProvider,
      text,
    }

    console.log('[home] send:', payload)
    setSending(true)

    try {
      await fetch('/api/chat', {
        body: JSON.stringify({
          messages: [
            {
              id: crypto.randomUUID(),
              parts: [{ text, type: 'text' }],
              role: 'user',
            },
          ],
          model: selectedModel,
          provider: selectedProvider,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      message.info('消息已发送（UI 演示模式）')
      setInput('')
    } catch (error) {
      console.error('[home] send failed:', error)
      message.error('发送失败')
    } finally {
      setSending(false)
    }
  }, [
    agentMode,
    input,
    message,
    selectedAgentId,
    selectedModel,
    selectedProvider,
    sending,
  ])

  return (
    <Block className={styles.shell} padding={16} variant='outlined'>
      <textarea
        className={styles.input}
        placeholder='提问、创建或开始任务。使用 @ 分配任务给其他智能体。'
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            void handleSend()
          }
        }}
      />

      <Flexbox horizontal align='center' justify='space-between' style={{ marginTop: 12 }}>
        <Flexbox horizontal align='center' gap={8}>
          <AgentModeButton />
          <ActionIcon icon={Plus} size='small' title='添加' />
        </Flexbox>

        <Flexbox horizontal align='center' gap={12}>
          <ModelSelector />
          <ActionIcon
            className={styles.send}
            icon={ArrowUp}
            loading={sending}
            size={{ blockSize: 32, size: 16 }}
            title='发送'
            onClick={() => void handleSend()}
          />
        </Flexbox>
      </Flexbox>
    </Block>
  )
})

HomeChatInput.displayName = 'HomeChatInput'

export default HomeChatInput
