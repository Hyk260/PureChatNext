'use client'

import { Block, Flexbox } from '@pure/ui'
import { useApp } from '@/components/AntdStaticMethods'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo, useEffect, useState } from 'react'

import { DEFAULT_PURE_AI_META, PURE_AI_AGENT_ID } from '@/const/home/agents'
import { setPendingChatText } from '@/features/chat/chatLocalStorage'
import SendArea from '@/features/chat/SendArea'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { useRouter } from '@/utils/navigation'

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
  shell: css`
    border-radius: 20px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.04);
  `,
}))

const HomeChatInput = memo(() => {
  const { message } = useApp()
  const router = useRouter()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const selectedAgentId = useHomeStore((s) => s.selectedAgentId)
  const activeAgent = useHomeStore((s) => s.activeAgent)
  const setActiveAgent = useHomeStore((s) => s.setActiveAgent)

  const agents = useAgentsStore((s) => s.agents)
  const fetchAgentsList = useAgentsStore((s) => s.fetchAgents)
  const canSend = Boolean(input.trim()) && !sending

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
        placeholder='随心输入'
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            handleSend()
          }
        }}
      />

      <Flexbox horizontal align='center' justify='flex-end' style={{ marginTop: 12 }}>
        <Flexbox horizontal align='center' gap={8}>
          {/* <AgentModeButton />
          <ActionIcon icon={Plus} size='small' title='添加' /> */}
        </Flexbox>

        <SendArea disabled={!canSend} loading={sending} onClick={handleSend} />
      </Flexbox>
    </Block>
  )
})

HomeChatInput.displayName = 'HomeChatInput'

export default HomeChatInput
