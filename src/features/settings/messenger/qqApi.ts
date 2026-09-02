import { apiFetch } from '@/utils/apiFetch'

export type QQConnectionMode = 'websocket' | 'webhook'
export type QQProviderId = 'purechat' | 'openai' | 'deepseek'
export type QQConfiguration = { agentId: string; model: string; provider: QQProviderId }

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
  model?: string | null
  provider?: QQProviderId | null
  runtimeStatus?: string
  webhookUrl?: string
}

export type QQQrStatus =
  | { qrCodeUrl: string; qrVersion: number; status: 'waiting' }
  | { appIds: string[]; status: 'selecting' }
  | { status: 'binding' }
  | { applicationId: string; status: 'connected' }
  | { message: string; status: 'failed' }

export type QQQrStartResult = QQQrStatus & { sessionId: string }

class QQApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'QQApiError'
  }
}

async function readApiError(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return new QQApiError(body.error || fallback, res.status)
}

export function isQQQrSessionMissingError(error: unknown): boolean {
  return error instanceof QQApiError && error.status === 404
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
  model?: string
  provider?: QQProviderId
}): Promise<void> {
  const res = await apiFetch('/api/channels/qq/bind', {
    body: JSON.stringify(params),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  if (!res.ok) {
    throw await readApiError(res, `bind failed: ${res.status}`)
  }
}

export async function startQQQrLogin(
  params: {
    agentId: string
    model?: string
    provider?: QQProviderId
  },
  signal?: AbortSignal
): Promise<QQQrStartResult> {
  const res = await apiFetch('/api/channels/qq/qrcode', {
    body: JSON.stringify(params),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    signal,
  })
  if (!res.ok) throw await readApiError(res, `qrcode failed: ${res.status}`)
  return res.json() as Promise<QQQrStartResult>
}

export async function pollQQQrLogin(sessionId: string, signal?: AbortSignal): Promise<QQQrStatus> {
  const res = await apiFetch(`/api/channels/qq/qrcode?sessionId=${encodeURIComponent(sessionId)}`, { signal })
  if (!res.ok) throw await readApiError(res, `qrcode status failed: ${res.status}`)
  return res.json() as Promise<QQQrStatus>
}

export async function completeQQQrLogin(sessionId: string, appId: string): Promise<void> {
  const res = await apiFetch('/api/channels/qq/qrcode', {
    body: JSON.stringify({ action: 'complete', appId, sessionId }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  if (!res.ok) throw await readApiError(res, `qrcode complete failed: ${res.status}`)
}

export async function cancelQQQrLogin(sessionId: string): Promise<void> {
  await apiFetch(`/api/channels/qq/qrcode?sessionId=${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
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
    throw await readApiError(res, `update agent failed: ${res.status}`)
  }
}

export async function updateQQConfiguration(config: QQConfiguration): Promise<void> {
  const res = await apiFetch('/api/channels/qq/bind', {
    body: JSON.stringify(config),
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  })
  if (!res.ok) {
    throw await readApiError(res, `update configuration failed: ${res.status}`)
  }
}
