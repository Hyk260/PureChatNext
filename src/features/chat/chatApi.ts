import type { UIMessage } from 'ai'
import type { ChatPermissionMode } from '@pure/types'

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
  permissionMode: ChatPermissionMode
  projectName: string | null
  title: string
  updatedAt: string
}

const toLocalTopic = (t: ApiTopic): LocalChatTopic => ({
  id: t.id,
  agentId: t.agentId,
  createdAt: new Date(t.createdAt).getTime(),
  favorite: Boolean(t.favorite),
  permissionMode: t.permissionMode,
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

export const createTopic = async (
  agentId: string,
  title?: string,
  permissionMode?: ChatPermissionMode,
  projectName?: string | null
): Promise<LocalChatTopic> => {
  const res = await apiFetch('/api/chat/topics', {
    body: JSON.stringify({
      agentId,
      permissionMode,
      ...(projectName ? { projectName } : {}),
      title,
    }),
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

export const createTopicShare = async (topicId: string): Promise<{ shareId: string }> => {
  const res = await apiFetch(`/api/chat/topics/${encodeURIComponent(topicId)}/share`, { method: 'POST' })
  if (!res.ok) throw new Error(`createTopicShare failed: ${res.status}`)

  return (await res.json()) as { shareId: string }
}

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

export type ToolApprovalStatus = 'approved' | 'denied' | 'completed' | 'failed'

const hashArgs = async (args: Record<string, unknown>) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(args)))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const upsertToolApproval = async (
  topicId: string,
  input: {
    apiName: string
    args: Record<string, unknown>
    identifier: string
    toolCallId: string
  }
) => {
  const argsHash = await hashArgs(input.args)
  const res = await apiFetch(`/api/chat/topics/${encodeURIComponent(topicId)}/tool-approvals`, {
    body: JSON.stringify({ ...input, argsHash }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  if (!res.ok) throw new Error(`upsertToolApproval failed: ${res.status}`)
  return res.json()
}

export const updateToolApproval = async (
  topicId: string,
  toolCallId: string,
  status: ToolApprovalStatus,
  error?: string
) => {
  const res = await apiFetch(
    `/api/chat/topics/${encodeURIComponent(topicId)}/tool-approvals/${encodeURIComponent(toolCallId)}`,
    {
      body: JSON.stringify({ error, status }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    }
  )
  if (!res.ok) throw new Error(`updateToolApproval failed: ${res.status}`)
  return res.json()
}
