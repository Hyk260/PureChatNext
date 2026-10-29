'use client'

import { toast } from '@lobehub/ui'
import { useCallback, useState } from 'react'

import type { DiscoverAgentItem, DiscoverAgentSummary } from '@/features/community/types'
import { installCommunityAgent } from '@/features/home/agentApi'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { useRouter } from 'next/navigation'

export function useAddCommunityAgent() {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const setSelectedAgentId = useHomeStore((s) => s.setSelectedAgentId)
  const upsertLocal = useAgentsStore((s) => s.upsertLocal)

  const addAgent = useCallback(
    async (item: DiscoverAgentItem | DiscoverAgentSummary) => {
      if (adding) return
      setAdding(true)

      try {
        const agent = await installCommunityAgent(item.identifier)
        upsertLocal(agent)
        setSelectedAgentId(agent.id)
        toast.success(`已添加「${agent.title}」到助理列表`)
        router.push(`/chat?agent=${encodeURIComponent(agent.id)}`)
      } catch (error) {
        console.error('[community] add agent failed:', error)
        toast.error('添加助理失败，请先登录后再试')
      } finally {
        setAdding(false)
      }
    },
    [adding, router, setSelectedAgentId, upsertLocal]
  )

  return { addAgent, adding }
}
