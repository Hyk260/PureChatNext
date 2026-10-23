import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_PURE_AI_META } from '@/const/home/agents'
import type { AgentListItem } from '@/const/home/agents'
import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { signOut } from '@/libs/better-auth/client'
import {
  createChatSession,
  registerChatSession,
  setChatRuntimeOwner,
  useChatRuntimeStore,
} from '@/features/chat/runtime/store'

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
    setChatRuntimeOwner(null)
    useAgentsStore.getState().reset()
    vi.mocked(signOut).mockReset()
    vi.unstubAllGlobals()
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

  it('revokes the browser refresh session before ending Better Auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.mocked(signOut).mockResolvedValue(undefined)

    await signOutWorkspace()

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('clears chat runtimes before revoking authentication', async () => {
    setChatRuntimeOwner('test-user')
    const session = createChatSession('test-user', 'agent', 'topic', [])
    registerChatSession(session)
    const stop = vi.spyOn(session.chat, 'stop')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })))
    vi.mocked(signOut).mockImplementation(() => {
      expect(stop).toHaveBeenCalledOnce()
      expect(useChatRuntimeStore.getState().sessions.size).toBe(0)
      return undefined
    })
    await signOutWorkspace()
    expect(registerChatSession(session)).toBe(false)
  })
})
