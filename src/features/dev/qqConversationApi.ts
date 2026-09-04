import { apiFetch } from '@/utils/apiFetch'

export type QQDevSession = {
  activeAgentId: string | null
  agentId: string
  agentTitle: string | null
  applicationId?: string
  bindingId?: string
  canSend: boolean
  conversationVersion: number
  externalUserId: string
  externalUserName: string | null
  id: string
  isOwnBinding?: boolean
  lastActiveAt: string
  threadType?: string | null
}

export type QQDevSessionsResponse = {
  agentId?: string
  agentTitle?: string | null
  bound: boolean
  sessions: QQDevSession[]
}

export type QQDevMessage = {
  attachments?: Array<{
    deliveryStatus: string
    fileName: string
    fileSize?: number | null
    fileUrl: string
    id: string
    summary?: string
    version: number
  }>
  createdAt: string
  durationMs?: number
  eventId: string
  fileName?: string
  fileSize?: number | null
  fileUrl?: string
  id: string
  imageUrl?: string
  messageKind?: string
  model?: string
  provider?: string
  role: 'assistant' | 'user'
  source: 'manual' | 'model' | 'system' | 'user'
  status?: string
  text: string
}

export type QQDevMessagesResponse = {
  cursor?: string
  messages: QQDevMessage[]
  session: QQDevSession
}

export async function fetchQQDevSessions(signal?: AbortSignal): Promise<QQDevSessionsResponse> {
  const res = await apiFetch('/api/dev/qq/sessions', { signal })
  if (!res.ok) throw new Error(`sessions failed: ${res.status}`)
  return res.json() as Promise<QQDevSessionsResponse>
}

export async function fetchQQDevSessionMessages(
  sessionId: string,
  options:
    | number
    | {
        conversationVersion?: number
        cursor?: string
        limit?: number
        signal?: AbortSignal
        watchEventIds?: string[]
      } = 50
): Promise<QQDevMessagesResponse> {
  const resolved = typeof options === 'number' ? { limit: options } : options
  const searchParams = new URLSearchParams({ limit: String(resolved.limit ?? 50) })
  if (resolved.cursor) searchParams.set('cursor', resolved.cursor)
  if (resolved.conversationVersion !== undefined) {
    searchParams.set('conversationVersion', String(resolved.conversationVersion))
  }
  for (const eventId of resolved.watchEventIds ?? []) searchParams.append('watchEventId', eventId)
  const res = await apiFetch(`/api/dev/qq/sessions/${encodeURIComponent(sessionId)}/messages?${searchParams}`, {
    signal: resolved.signal,
  })
  if (!res.ok) throw new Error(`messages failed: ${res.status}`)
  return res.json() as Promise<QQDevMessagesResponse>
}

export async function sendQQDevMessage(
  sessionId: string,
  payload: string | { requestId?: string; text?: string }
): Promise<QQDevMessage> {
  const resolved = typeof payload === 'string' ? { text: payload } : payload
  const text = resolved.text?.trim() ?? ''
  const requestId = resolved.requestId ?? crypto.randomUUID()

  const res = await apiFetch(`/api/dev/qq/sessions/${encodeURIComponent(sessionId)}/messages`, {
    body: JSON.stringify({ requestId, text }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || `send failed: ${res.status}`)
  }
  const data = (await res.json()) as { message: QQDevMessage }
  if (!data.message) throw new Error('发送成功但未返回消息记录，请刷新会话确认状态')
  return data.message
}
