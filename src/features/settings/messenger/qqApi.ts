import { apiFetch } from '@/utils/apiFetch'

export type QQConnectionMode = 'websocket' | 'webhook'

export type QQStatus = {
  agentId?: string
  appId?: string
  applicationId?: string
  connected: boolean
  connectionMode?: QQConnectionMode
  enabled?: boolean
  gatewaySupported?: boolean
  lastActiveAt?: string | null
  lastError?: { code: string; message: string } | null
  lastHeartbeatAt?: string | null
  runtimeStatus?: string
  webhookUrl?: string
}

export async function fetchQQStatus(): Promise<QQStatus> {
  const res = await apiFetch('/api/channels/qq/status')
  if (!res.ok) throw new Error(`status failed: ${res.status}`)
  return res.json() as Promise<QQStatus>
}

export async function bindQQ(params: {
  agentId: string
  appId: string
  appSecret: string
  connectionMode: QQConnectionMode
}): Promise<void> {
  const res = await apiFetch('/api/channels/qq/bind', {
    body: JSON.stringify(params),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `bind failed: ${res.status}`)
  }
}

export async function unbindQQ(): Promise<void> {
  const res = await apiFetch('/api/channels/qq/bind', { method: 'DELETE' })
  if (!res.ok) throw new Error(`unbind failed: ${res.status}`)
}

export async function updateQQAgent(agentId: string): Promise<void> {
  const res = await apiFetch('/api/channels/qq/bind', {
    body: JSON.stringify({ agentId }),
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `update agent failed: ${res.status}`)
  }
}
