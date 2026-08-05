import { apiFetch } from '@/utils/apiFetch'

export type WechatStatus = {
  agentId?: string
  applicationId?: string
  bound?: boolean
  connected: boolean
  enabled?: boolean
  failedEventCount?: number
  gatewaySupported?: boolean
  lastActiveAt?: string | null
  lastError?: { code: string; message: string } | null
  lastHeartbeatAt?: string | null
  needsRebind: boolean
  runtimeStatus?: 'starting' | 'online' | 'degraded' | 'offline' | 'needs_rebind' | 'stopped'
}

export async function retryFailedWechatEvents(): Promise<number> {
  const res = await apiFetch('/api/channels/wechat/events/retry', { method: 'POST' })
  const body = (await res.json().catch(() => ({}))) as { error?: string; requeued?: number }
  if (!res.ok) throw new Error(body.error || `retry failed: ${res.status}`)
  return body.requeued ?? 0
}

export type WechatQrCode = {
  qrcode: string
  qrcode_img_content: string
}

export type WechatQrStatus = {
  bot_token?: string
  ilink_bot_id?: string
  ilink_user_id?: string
  status: 'wait' | 'scaned' | 'confirmed' | 'expired'
}

export async function fetchWechatStatus(): Promise<WechatStatus> {
  const res = await apiFetch('/api/channels/wechat/status')
  if (!res.ok) throw new Error(`status failed: ${res.status}`)
  return res.json() as Promise<WechatStatus>
}

export async function fetchWechatQrCode(): Promise<WechatQrCode> {
  const res = await apiFetch('/api/channels/wechat/qrcode', { method: 'POST' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `qrcode failed: ${res.status}`)
  }
  return res.json() as Promise<WechatQrCode>
}

export async function pollWechatQrStatus(qrcode: string, signal?: AbortSignal): Promise<WechatQrStatus> {
  const res = await apiFetch(`/api/channels/wechat/qrcode/status?qrcode=${encodeURIComponent(qrcode)}`, { signal })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `poll failed: ${res.status}`)
  }
  return res.json() as Promise<WechatQrStatus>
}

export async function bindWechat(params: {
  agentId: string
  botId: string
  botToken: string
  userId: string
}): Promise<void> {
  const res = await apiFetch('/api/channels/wechat/bind', {
    body: JSON.stringify(params),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `bind failed: ${res.status}`)
  }
}

export async function unbindWechat(): Promise<void> {
  const res = await apiFetch('/api/channels/wechat/bind', { method: 'DELETE' })
  if (!res.ok) throw new Error(`unbind failed: ${res.status}`)
}

export async function updateWechatAgent(agentId: string): Promise<void> {
  const res = await apiFetch('/api/channels/wechat/bind', {
    body: JSON.stringify({ agentId }),
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `update agent failed: ${res.status}`)
  }
}
