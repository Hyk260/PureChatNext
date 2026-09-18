import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_PURE_AI_META } from '@/const/home/agents'
import type { AgentListItem } from '@/const/home/agents'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { signOut } from '@/libs/better-auth/client'

import { signOutWorkspace } from './signOutWorkspace'

vi.mock('@/libs/better-auth/client', () => ({
  signOut: vi.fn(),
}))

const customAgent: AgentListItem = {
  avatar: '🤖',
  description: 'custom',
  id: 'agt_custom',
  isBuiltin: false,
  slug: 'custom',
  systemRole: '',
  title: 'Custom',
}

describe('signOutWorkspace', () => {
  afterEach(() => {
    useAgentsStore.getState().reset()
    vi.mocked(signOut).mockReset()
  })

  it('resets cached agents before ending the session', async () => {
    useAgentsStore.setState({ agents: [customAgent], loaded: true })
    vi.mocked(signOut).mockResolvedValue(undefined)

    await signOutWorkspace()

    expect(useAgentsStore.getState()).toMatchObject({
      agents: [DEFAULT_PURE_AI_META],
      loaded: false,
    })
    expect(signOut).toHaveBeenCalledTimes(1)
  })
})
