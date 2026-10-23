import { create } from 'zustand'

import type { UIMessage } from 'ai'
import { ChatSession } from './chatSession'

type RuntimeState = {
  ownerId: string | null | undefined
  sessions: Map<string, ChatSession>
  busy: Record<string, boolean>
  commands: Record<string, ReadonlySet<string>>
  topicsRevision: Record<string, number>
}

export const topicRuntimeKey = (agentId: string, topicId: string | null) => JSON.stringify([agentId, topicId])

export const useChatRuntimeStore = create<RuntimeState>(() => ({
  ownerId: undefined,
  sessions: new Map(),
  busy: {},
  commands: {},
  topicsRevision: {},
}))

export const findChatSession = (userId: string, agentId: string, topicId: string | null) =>
  useChatRuntimeStore.getState().sessions.get(JSON.stringify([userId, agentId, topicId]))

export const createChatSession = (userId: string, agentId: string, topicId: string | null, messages: UIMessage[]) => {
  const existing = findChatSession(userId, agentId, topicId)
  if (existing) return existing
  const session = new ChatSession({
    userId,
    agentId,
    topicId,
    messages,
    onChange: () => {
      const state = useChatRuntimeStore.getState()
      if (state.sessions.get(session.key) !== session) return
      const key = topicRuntimeKey(agentId, topicId)
      if (state.busy[key] === session.busy && state.commands[key] === session.runningCommandCallIds) return
      useChatRuntimeStore.setState({
        busy: { ...state.busy, [key]: session.busy },
        commands: { ...state.commands, [key]: session.runningCommandCallIds },
      })
    },
    onTopicsRefresh: () => {
      const state = useChatRuntimeStore.getState()
      if (state.sessions.get(session.key) !== session) return
      useChatRuntimeStore.setState({
        topicsRevision: {
          ...state.topicsRevision,
          [agentId]: (state.topicsRevision[agentId] ?? 0) + 1,
        },
      })
    },
  })
  return session
}

export const registerChatSession = (session: ChatSession) => {
  const state = useChatRuntimeStore.getState()
  if (state.ownerId !== undefined && state.ownerId !== session.userId) {
    session.suspend()
    return false
  }
  if (state.sessions.has(session.key)) return state.sessions.get(session.key) === session
  const key = topicRuntimeKey(session.agentId, session.topicId)
  useChatRuntimeStore.setState({
    sessions: new Map(state.sessions).set(session.key, session),
    busy: { ...state.busy, [key]: session.busy },
    commands: { ...state.commands, [key]: session.runningCommandCallIds },
  })
  return true
}

export const setChatRuntimeOwner = (ownerId: string | null) => {
  const state = useChatRuntimeStore.getState()
  if (ownerId === state.ownerId && (ownerId !== null || state.sessions.size === 0)) return
  const sessions = new Map(state.sessions)
  for (const [key, session] of sessions) {
    if (session.userId === ownerId) continue
    session.suspend()
    sessions.delete(key)
  }
  const busy: RuntimeState['busy'] = {}
  const commands: RuntimeState['commands'] = {}
  for (const session of sessions.values()) {
    const key = topicRuntimeKey(session.agentId, session.topicId)
    busy[key] = session.busy
    commands[key] = session.runningCommandCallIds
  }
  useChatRuntimeStore.setState({ ownerId, sessions, busy, commands, topicsRevision: {} })
}

/** Drain in-flight writes before deleting, and suppress all later tool/stream callbacks. */
export const deleteChatSessions = async (
  userId: string,
  agentId: string,
  topicIds: string[],
  remove: () => Promise<string[]>
) => {
  const sessions = topicIds.flatMap((id) => {
    const session = findChatSession(userId, agentId, id)
    return session ? [session] : []
  })
  await Promise.all(sessions.map((session) => session.suspend()))
  try {
    const deleted = await remove()
    const deletedIds = new Set(deleted)
    const state = useChatRuntimeStore.getState()
    const next = new Map(state.sessions)
    const busy = { ...state.busy }
    const commands = { ...state.commands }
    for (const session of sessions) {
      if (session.topicId && deletedIds.has(session.topicId)) {
        next.delete(session.key)
        const key = topicRuntimeKey(session.agentId, session.topicId)
        delete busy[key]
        delete commands[key]
      } else session.resume()
    }
    useChatRuntimeStore.setState({ sessions: next, busy, commands })
    return deleted
  } catch (error) {
    sessions.forEach((session) => session.resume())
    throw error
  }
}
