import type { AgentListItem } from '@/const/home/agents'
import { apiFetch, jsonInit } from '@/utils/apiFetch'

export type ApiAgent = {
  avatar: string | null
  backgroundColor: string | null
  description: string | null
  id: string
  isBuiltin: boolean
  marketIdentifier?: string | null
  openingMessage?: string | null
  openingQuestions?: string[] | null
  pinned: boolean | null
  slug: string
  systemRole: string | null
  title: string
}

export type AgentCreateBody = {
  avatar?: string
  backgroundColor?: string
  description?: string
  marketIdentifier?: string
  openingMessage?: string | null
  openingQuestions?: string[] | null
  systemRole?: string
  title: string
}

export type AgentUpdateBody = Partial<AgentCreateBody> & {
  pinned?: boolean
  sort?: number
}

const toListItem = (a: ApiAgent): AgentListItem => ({
  avatar: a.avatar ?? '🤖',
  backgroundColor: a.backgroundColor,
  description: a.description,
  id: a.id,
  isBuiltin: a.isBuiltin,
  marketIdentifier: a.marketIdentifier ?? null,
  openingMessage: a.openingMessage,
  openingQuestions: a.openingQuestions,
  pinned: a.pinned,
  slug: a.slug,
  systemRole: a.systemRole ?? '',
  title: a.title,
})

export const fetchAgents = async (): Promise<AgentListItem[]> => {
  const res = await apiFetch('/api/agents')
  if (!res.ok) throw new Error(`fetchAgents failed: ${res.status}`)
  const items = (await res.json()) as ApiAgent[]
  return items.map(toListItem)
}

export const fetchAgent = async (id: string): Promise<AgentListItem> => {
  const res = await apiFetch(`/api/agents/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(`fetchAgent failed: ${res.status}`)
  return toListItem((await res.json()) as ApiAgent)
}

export const createAgent = async (body: AgentCreateBody): Promise<AgentListItem> => {
  const res = await apiFetch('/api/agents', jsonInit(body, { method: 'POST' }))
  if (!res.ok) throw new Error(`createAgent failed: ${res.status}`)
  return toListItem((await res.json()) as ApiAgent)
}

export const updateAgent = async (id: string, body: AgentUpdateBody): Promise<AgentListItem> => {
  const res = await apiFetch(`/api/agents/${encodeURIComponent(id)}`, jsonInit(body, { method: 'PATCH' }))
  if (!res.ok) throw new Error(`updateAgent failed: ${res.status}`)
  return toListItem((await res.json()) as ApiAgent)
}

export const deleteAgent = async (id: string): Promise<void> => {
  const res = await apiFetch(`/api/agents/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (res.status === 403) throw new Error('BUILTIN')
  if (!res.ok) throw new Error(`deleteAgent failed: ${res.status}`)
}
