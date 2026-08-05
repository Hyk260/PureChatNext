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
  createdAt: string
  fileName?: string
  fileSize?: number | null
  fileUrl?: string
  id: string
  imageUrl?: string
  messageKind?: string
  role: 'assistant' | 'user'
  status?: string
  text: string
}

export type WechatDevMessagesResponse = {
  messages: WechatDevMessage[]
  session: WechatDevSession
}

export async function fetchWechatDevSessions(): Promise<WechatDevSessionsResponse> {
  const res = await apiFetch('/api/dev/wechat/sessions')
  if (!res.ok) throw new Error(`sessions failed: ${res.status}`)
  return res.json() as Promise<WechatDevSessionsResponse>
}

export async function fetchWechatDevSessionMessages(
  sessionId: string,
  limit = 50
): Promise<WechatDevMessagesResponse> {
  const res = await apiFetch(
    `/api/dev/wechat/sessions/${encodeURIComponent(sessionId)}/messages?limit=${limit}`
  )
  if (!res.ok) throw new Error(`messages failed: ${res.status}`)
  return res.json() as Promise<WechatDevMessagesResponse>
}

export async function sendWechatDevMessage(sessionId: string, text: string): Promise<WechatDevMessage> {
  const res = await apiFetch(`/api/dev/wechat/sessions/${encodeURIComponent(sessionId)}/messages`, {
    body: JSON.stringify({ text }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || `send failed: ${res.status}`)
  }
  const data = (await res.json()) as { message: WechatDevMessage }
  return data.message
}
