import { type UIMessage } from 'ai'

import { apiFetch } from '@/utils/apiFetch'

import { type LocalChatTopic } from './types'

type ApiTopic = {
  id: string
  agentId: string
  title: string
  updatedAt: string
}

const toLocalTopic = (t: ApiTopic): LocalChatTopic => ({
  id: t.id,
  agentId: t.agentId,
  title: t.title,
  updatedAt: new Date(t.updatedAt).getTime(),
})

export const fetchTopics = async (agentId: string): Promise<LocalChatTopic[]> => {
  const res = await apiFetch(`/api/chat/topics?agentId=${encodeURIComponent(agentId)}`)
  if (!res.ok) throw new Error(`fetchTopics failed: ${res.status}`)

  const items = (await res.json()) as ApiTopic[]
  return items.map(toLocalTopic)
}

export const createTopic = async (agentId: string, title?: string): Promise<LocalChatTopic> => {
  const res = await apiFetch('/api/chat/topics', {
    body: JSON.stringify({ agentId, title }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  if (!res.ok) throw new Error(`createTopic failed: ${res.status}`)

  return toLocalTopic((await res.json()) as ApiTopic)
}

export const renameTopic = async (id: string, title: string): Promise<LocalChatTopic> => {
  const res = await apiFetch(`/api/chat/topics/${encodeURIComponent(id)}`, {
    body: JSON.stringify({ title }),
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  })
  if (!res.ok) throw new Error(`renameTopic failed: ${res.status}`)

  return toLocalTopic((await res.json()) as ApiTopic)
}

export const deleteTopic = async (id: string): Promise<void> => {
  const res = await apiFetch(`/api/chat/topics/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteTopic failed: ${res.status}`)
}

export const fetchMessages = async (topicId: string): Promise<UIMessage[]> => {
  const res = await apiFetch(`/api/chat/topics/${encodeURIComponent(topicId)}/messages`)
  if (!res.ok) throw new Error(`fetchMessages failed: ${res.status}`)

  return (await res.json()) as UIMessage[]
}

export const putMessages = async (
  topicId: string,
  messages: UIMessage[],
  init?: { signal?: AbortSignal }
): Promise<void> => {
  const res = await apiFetch(`/api/chat/topics/${encodeURIComponent(topicId)}/messages`, {
    body: JSON.stringify({ messages }),
    headers: { 'Content-Type': 'application/json' },
    method: 'PUT',
    signal: init?.signal,
  })
  if (!res.ok) throw new Error(`putMessages failed: ${res.status}`)
}
