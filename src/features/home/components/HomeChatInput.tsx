'use client'

import { ActionIcon, Block, Flexbox } from '@lobehub/ui'
import { App } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { ArrowUp } from 'lucide-react'
import { useRouter } from '@/utils/navigation'
import { memo, useEffect, useState } from 'react'

import { DEFAULT_PURE_AI_META, PURE_AI_AGENT_ID } from '@/const/home/agents'
import { setPendingChatText } from '@/features/chat/chatLocalStorage'
import ModelSelector from '@/features/home/components/ModelSelector'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
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
  const router = useRouter()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const selectedAgentId = useHomeStore((s) => s.selectedAgentId)
  const activeAgent = useHomeStore((s) => s.activeAgent)
  const setActiveAgent = useHomeStore((s) => s.setActiveAgent)

  const agents = useAgentsStore((s) => s.agents)
  const fetchAgentsList = useAgentsStore((s) => s.fetchAgents)

  useEffect(() => {
    fetchAgentsList()
  }, [fetchAgentsList])

  const handleSend = () => {
    const text = input.trim()
    if (!text || sending) return

    setSending(true)

    try {
      const agentId = selectedAgentId || PURE_AI_AGENT_ID
      const listed = agents.find((agent) => agent.id === agentId)

      if (listed) {
        setActiveAgent({
          avatar: listed.avatar,
          identifier: listed.id,
          systemRole: listed.systemRole,
          title: listed.title,
        })
      } else if (activeAgent?.identifier !== agentId) {
        const fallback = agents[0] ?? DEFAULT_PURE_AI_META
        setActiveAgent({
          avatar: fallback.avatar,
          identifier: fallback.id,
          systemRole: fallback.systemRole,
          title: fallback.title,
        })
      }

      setPendingChatText(text)
      setInput('')
      router.push(`/chat?agent=${encodeURIComponent(agentId)}`)
    } catch (error) {
      console.error('[home] start chat failed:', error)
      message.error('无法开始对话')
      setSending(false)
    }
  }

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
            handleSend()
          }
        }}
      />

      <Flexbox horizontal align='center' justify='space-between' style={{ marginTop: 12 }}>
        <Flexbox horizontal align='center' gap={8}>
          {/* <AgentModeButton />
          <ActionIcon icon={Plus} size='small' title='添加' /> */}
        </Flexbox>

        <Flexbox horizontal align='center' gap={12}>
          <ModelSelector />
          <ActionIcon
            className={styles.send}
            icon={ArrowUp}
            loading={sending}
            size={{ blockSize: 32, size: 16 }}
            title='发送'
            onClick={handleSend}
          />
        </Flexbox>
      </Flexbox>
    </Block>
  )
})

HomeChatInput.displayName = 'HomeChatInput'

export default HomeChatInput
