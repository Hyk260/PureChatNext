import type { UIMessage } from 'ai'

import { apiFetch } from '@/utils/apiFetch'

import type { LocalChatTopic, TopicDeleteScope, TopicUpdate } from './types'

export type AutoRenameTopicConfig = {
  apiKey?: string
  baseURL?: string
  model: string
  provider: string
}

type ApiTopic = {
  id: string
  agentId: string
  createdAt: string
  favorite: boolean
  projectName: string | null
  title: string
  updatedAt: string
}

const toLocalTopic = (t: ApiTopic): LocalChatTopic => ({
  id: t.id,
  agentId: t.agentId,
  createdAt: new Date(t.createdAt).getTime(),
  favorite: Boolean(t.favorite),
  projectName: t.projectName ?? null,
  title: t.title,
  updatedAt: new Date(t.updatedAt).getTime(),
})

/** Share one GET across Strict Mode remounts for the same agentId. */
const topicsInflight = new Map<string, Promise<LocalChatTopic[]>>()

export const fetchTopics = async (agentId: string): Promise<LocalChatTopic[]> => {
  const existing = topicsInflight.get(agentId)
  if (existing) return existing

  const request = (async () => {
    const res = await apiFetch(`/api/chat/topics?agentId=${encodeURIComponent(agentId)}`)
    if (!res.ok) throw new Error(`fetchTopics failed: ${res.status}`)

    const items = (await res.json()) as ApiTopic[]
    return items.map(toLocalTopic)
  })()

  topicsInflight.set(agentId, request)
  void request.finally(() => {
    if (topicsInflight.get(agentId) === request) topicsInflight.delete(agentId)
  })
  return request
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

export const updateTopic = async (id: string, patch: TopicUpdate): Promise<LocalChatTopic> => {
  const res = await apiFetch(`/api/chat/topics/${encodeURIComponent(id)}`, {
    body: JSON.stringify(patch),
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  })
  if (!res.ok) throw new Error(`updateTopic failed: ${res.status}`)

  return toLocalTopic((await res.json()) as ApiTopic)
}

export const renameTopic = async (id: string, title: string): Promise<LocalChatTopic> => updateTopic(id, { title })

export const autoRenameTopic = async (
  id: string,
  { apiKey, baseURL, model, provider }: AutoRenameTopicConfig
): Promise<LocalChatTopic> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`

  const res = await apiFetch(`/api/chat/topics/${encodeURIComponent(id)}/auto-rename`, {
    body: JSON.stringify({
      ...(baseURL?.trim() ? { baseURL: baseURL.trim() } : {}),
      model,
      provider,
    }),
    headers,
    method: 'POST',
  })
  if (!res.ok) throw new Error(`autoRenameTopic failed: ${res.status}`)

  return toLocalTopic((await res.json()) as ApiTopic)
}

export const deleteTopic = async (id: string): Promise<void> => {
  const res = await apiFetch(`/api/chat/topics/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteTopic failed: ${res.status}`)
}

export const deleteTopics = async (agentId: string, scope: TopicDeleteScope): Promise<string[]> => {
  const params = new URLSearchParams({ agentId, scope })
  const res = await apiFetch(`/api/chat/topics?${params.toString()}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteTopics failed: ${res.status}`)

  const payload = (await res.json()) as { deletedIds: string[] }
  return payload.deletedIds
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
