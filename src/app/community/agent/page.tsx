'use client'

import { Suspense } from 'react'

import AgentPage from '@/features/community/AgentPage'

export default function CommunityAgentPage() {
  return (
    <Suspense fallback={null}>
      <AgentPage />
    </Suspense>
  )
}
