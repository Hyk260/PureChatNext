import { apiFetch, jsonInit } from '@/utils/apiFetch'

const SESSIONS_PATH = '/api/admin/qq/sessions'

export type QQSession = {
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

export type QQSessionsResponse = {
  agentId?: string
  agentTitle?: string | null
  bound: boolean
  sessions: QQSession[]
}

export type QQAttachment = {
  deliveryStatus: string
  fileName: string
  fileSize?: number | null
  fileUrl: string
  id: string
  summary?: string
  version: number
}

export type QQMessage = {
  attachments?: QQAttachment[]
  authorId?: string
  authorName?: string
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

export type QQMessagesResponse = {
  cursor?: string
  messages: QQMessage[]
  session: QQSession
}

export async function fetchQQSessions(signal?: AbortSignal): Promise<QQSessionsResponse> {
  const res = await apiFetch(SESSIONS_PATH, { signal })
  if (!res.ok) throw new Error(`sessions failed: ${res.status}`)
  return res.json() as Promise<QQSessionsResponse>
}

export async function fetchQQSessionMessages(
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
): Promise<QQMessagesResponse> {
  const resolved = typeof options === 'number' ? { limit: options } : options
  const searchParams = new URLSearchParams({ limit: String(resolved.limit ?? 50) })
  if (resolved.cursor) searchParams.set('cursor', resolved.cursor)
  if (resolved.conversationVersion !== undefined) {
    searchParams.set('conversationVersion', String(resolved.conversationVersion))
  }
  for (const eventId of resolved.watchEventIds ?? []) searchParams.append('watchEventId', eventId)

  const res = await apiFetch(
    `${SESSIONS_PATH}/${encodeURIComponent(sessionId)}/messages?${searchParams}`,
    { signal: resolved.signal }
  )
  if (!res.ok) throw new Error(`messages failed: ${res.status}`)
  return res.json() as Promise<QQMessagesResponse>
}

export async function sendQQMessage(
  sessionId: string,
  payload: string | { files?: File[]; requestId?: string; text?: string }
): Promise<QQMessage> {
  const resolved = typeof payload === 'string' ? { text: payload } : payload
  const text = resolved.text?.trim() ?? ''
  const files = resolved.files ?? []
  const requestId = resolved.requestId ?? crypto.randomUUID()
  const hasFiles = files.length > 0
  const url = `${SESSIONS_PATH}/${encodeURIComponent(sessionId)}/messages`

  const res = hasFiles
    ? await apiFetch(url, {
        body: (() => {
          const form = new FormData()
          if (text) form.set('text', text)
          form.set('requestId', requestId)
          for (const file of files) form.append('files', file)
          return form
        })(),
        method: 'POST',
      })
    : await apiFetch(url, jsonInit({ requestId, text }, { method: 'POST' }))
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || `send failed: ${res.status}`)
  }
  const data = (await res.json()) as { message: QQMessage }
  if (!data.message) throw new Error('发送成功但未返回消息记录，请刷新会话确认状态')
  return data.message
}
