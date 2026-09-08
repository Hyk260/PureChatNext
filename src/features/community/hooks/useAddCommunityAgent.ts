'use client'

import { useApp } from '@/components/AntdStaticMethods'
import { useCallback, useState } from 'react'

import type { DiscoverAgentItem } from '@/features/community/types'
import { createAgent } from '@/features/home/agentApi'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { useRouter } from '@/utils/navigation'

import { toActiveCommunityAgent } from '@/features/community/toActiveCommunityAgent'

export function useAddCommunityAgent() {
  const { message } = useApp()
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const setActiveAgent = useHomeStore((s) => s.setActiveAgent)
  const setSelectedAgentId = useHomeStore((s) => s.setSelectedAgentId)
  const upsertLocal = useAgentsStore((s) => s.upsertLocal)

  const addAgent = useCallback(
    async (item: DiscoverAgentItem) => {
      if (adding) return
      setAdding(true)

      try {
        const agent = await createAgent({
          avatar: item.avatar,
          backgroundColor: item.backgroundColor,
          description: item.description,
          marketIdentifier: item.identifier,
          openingMessage: item.openingMessage ?? null,
          openingQuestions: item.openingQuestions ?? [],
          systemRole: item.systemRole,
          title: item.title,
        })
        upsertLocal(agent)
        setSelectedAgentId(agent.id)
        setActiveAgent(toActiveCommunityAgent(agent))
        message.success(`已添加「${agent.title}」到助理列表`)
        router.push(`/chat?agent=${encodeURIComponent(agent.id)}`)
      } catch (error) {
        console.error('[community] add agent failed:', error)
        message.error('添加助理失败，请先登录后再试')
      } finally {
        setAdding(false)
      }
    },
    [adding, message, router, setActiveAgent, setSelectedAgentId, upsertLocal]
  )

  return { addAgent, adding }
}
