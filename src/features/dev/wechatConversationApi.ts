import { apiFetch } from '@/utils/apiFetch'

export type WechatDevSession = {
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
}

export type WechatDevSessionsResponse = {
  agentId?: string
  agentTitle?: string | null
  bound: boolean
  ownerExternalUserId?: string | null
  sessions: WechatDevSession[]
}

export type WechatDevMessage = {
  attachments?: Array<{
    deliveryError?: string
    deliveryStatus: string
    fileName: string
    fileSize: number
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

export type WechatDevMessagesResponse = {
  cursor?: string
  messages: WechatDevMessage[]
  session: WechatDevSession
}

export async function fetchWechatDevSessions(signal?: AbortSignal): Promise<WechatDevSessionsResponse> {
  const res = await apiFetch('/api/dev/wechat/sessions', { signal })
  if (!res.ok) throw new Error(`sessions failed: ${res.status}`)
  return res.json() as Promise<WechatDevSessionsResponse>
}

export async function fetchWechatDevSessionMessages(
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
): Promise<WechatDevMessagesResponse> {
  const resolved = typeof options === 'number' ? { limit: options } : options
  const searchParams = new URLSearchParams({ limit: String(resolved.limit ?? 50) })
  if (resolved.cursor) searchParams.set('cursor', resolved.cursor)
  if (resolved.conversationVersion !== undefined) {
    searchParams.set('conversationVersion', String(resolved.conversationVersion))
  }
  for (const eventId of resolved.watchEventIds ?? []) searchParams.append('watchEventId', eventId)
  const res = await apiFetch(`/api/dev/wechat/sessions/${encodeURIComponent(sessionId)}/messages?${searchParams}`, {
    signal: resolved.signal,
  })
  if (!res.ok) throw new Error(`messages failed: ${res.status}`)
  return res.json() as Promise<WechatDevMessagesResponse>
}

export async function sendWechatDevMessage(
  sessionId: string,
  payload: string | { files?: File[]; requestId?: string; text?: string }
): Promise<WechatDevMessage> {
  const resolved = typeof payload === 'string' ? { text: payload } : payload
  const text = resolved.text?.trim() ?? ''
  const files = resolved.files ?? []
  const requestId = resolved.requestId ?? crypto.randomUUID()
  const hasFiles = files.length > 0

  const res = await apiFetch(`/api/dev/wechat/sessions/${encodeURIComponent(sessionId)}/messages`, {
    body: hasFiles
      ? (() => {
          const form = new FormData()
          if (text) form.set('text', text)
          form.set('requestId', requestId)
          for (const file of files) form.append('files', file)
          return form
        })()
      : JSON.stringify({ requestId, text }),
    ...(hasFiles ? {} : { headers: { 'Content-Type': 'application/json' } }),
    method: 'POST',
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || `send failed: ${res.status}`)
  }
  const data = (await res.json()) as { message: WechatDevMessage }
  if (!data.message) throw new Error('发送成功但未返回消息记录，请刷新会话确认状态')
  return data.message
}
