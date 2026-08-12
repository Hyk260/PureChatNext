import type { QQApiClient } from './api'
import { QQ_INTENTS, QQ_WS_OP_CODES } from './types'
import type { QQGatewayHelloData, QQGatewayPayload, QQGatewayReadyData, QQGatewayUrlResponse } from './types'

export type GatewayLogger = (message: string, ...args: unknown[]) => void

const noop: GatewayLogger = () => {}
const RECONNECT_BASE_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 30_000
const MAX_RECONNECT_ATTEMPTS = 10
const HEARTBEAT_MIN_INTERVAL_MS = 1_000
const HEARTBEAT_MAX_INTERVAL_MS = 300_000
const HEARTBEAT_DEFAULT_INTERVAL_MS = 45_000
const DEFAULT_INTENTS = QQ_INTENTS.PUBLIC_GUILD_MESSAGES | QQ_INTENTS.DIRECT_MESSAGE | QQ_INTENTS.GROUP_AND_C2C_EVENT

export interface QQGatewayOptions {
  abortSignal?: AbortSignal
  durationMs?: number
  intents?: number
  log?: GatewayLogger
  onForwardError?: (error: Error) => void
  onStatus?: (status: 'online' | 'degraded', detail?: { code: string; message: string }) => void
  shard?: [number, number]
  webhookHeaders?: Record<string, string>
  webhookUrl: string
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    }, { once: true })
  })
}

/** Persistent QQ Bot Gateway connection with explicit readiness and terminal lifecycle. */
export class QQGatewayConnection {
  readonly done: Promise<void>
  private readonly abortSignal?: AbortSignal
  private readonly api: QQApiClient
  private readonly durationMs?: number
  private readonly intents: number
  private readonly log: GatewayLogger
  private readonly onForwardError?: (error: Error) => void
  private readonly onStatus?: QQGatewayOptions['onStatus']
  private readonly shard: [number, number]
  private readonly webhookHeaders: Record<string, string>
  private readonly webhookUrl: string
  private closed = false
  private doneReject!: (error: Error) => void
  private doneResolve!: () => void
  private durationTimer: ReturnType<typeof setTimeout> | null = null
  private forwardChain: Promise<void> = Promise.resolve()
  private gatewayUrl: string | null = null
  private hasConnected = false
  private heartbeatAcked = true
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private heartbeatJitterTimer: ReturnType<typeof setTimeout> | null = null
  private openConnectionError: Error | null = null
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private resumeGatewayUrl: string | null = null
  private seq: number | null = null
  private sessionId: string | null = null
  private settled = false
  private ws: WebSocket | null = null

  constructor(api: QQApiClient, options: QQGatewayOptions) {
    this.api = api
    this.intents = options.intents ?? DEFAULT_INTENTS
    this.log = options.log ?? noop
    this.shard = options.shard ?? [0, 1]
    this.webhookUrl = options.webhookUrl
    this.webhookHeaders = options.webhookHeaders ?? {}
    this.abortSignal = options.abortSignal
    this.durationMs = options.durationMs
    this.onStatus = options.onStatus
    this.onForwardError = options.onForwardError
    this.done = new Promise<void>((resolve, reject) => {
      this.doneResolve = resolve
      this.doneReject = reject
    })
    this.abortSignal?.addEventListener('abort', this.handleAbort, { once: true })
  }

  async connect(): Promise<void> {
    if (this.abortSignal?.aborted || this.closed) {
      this.close()
      return
    }
    const gatewayInfo: QQGatewayUrlResponse = await this.api.getGatewayUrl()
    this.gatewayUrl = gatewayInfo.url
    this.log('Gateway URL: %s (shards: %d)', this.gatewayUrl, gatewayInfo.shards ?? 1)
    if (this.durationMs) {
      this.durationTimer = setTimeout(() => this.close(), this.durationMs)
    }
    await this.openConnection(this.gatewayUrl, false)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.clearTimers()
    this.abortSignal?.removeEventListener('abort', this.handleAbort)
    const socket = this.ws
    this.ws = null
    socket?.close(1000, 'Client shutdown')
    this.settleDone()
  }

  private readonly handleAbort = () => this.close()

  private settleDone(error?: Error) {
    if (this.settled) return
    this.settled = true
    if (error) this.doneReject(error)
    else this.doneResolve()
  }

  private clearTimers() {
    this.stopHeartbeat()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.durationTimer) clearTimeout(this.durationTimer)
    this.reconnectTimer = null
    this.durationTimer = null
  }

  private openConnection(url: string, isResume: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.closed || this.abortSignal?.aborted) return reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      const ws = new WebSocket(url)
      this.ws = ws
      let readySettled = false
      this.openConnectionError = null

      const finishReady = (error?: Error) => {
        if (readySettled) return
        readySettled = true
        if (error) reject(error)
        else resolve()
      }

      ws.addEventListener('open', () => this.log('WebSocket connected (resume=%s)', isResume))
      ws.addEventListener('message', (event) => {
        let payload: QQGatewayPayload
        try {
          const data = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer)
          payload = JSON.parse(data)
        } catch {
          this.log('Failed to parse gateway message')
          return
        }
        this.handlePayload(payload, isResume, finishReady)
      })
      ws.addEventListener('error', () => {
        if (!readySettled) finishReady(new Error('WebSocket connection failed'))
      })
      ws.addEventListener('close', (event) => {
        this.stopHeartbeat()
        if (this.ws === ws) this.ws = null
        const error = this.openConnectionError
        this.openConnectionError = null
        if (!readySettled) {
          finishReady(error ?? new Error(`QQ gateway socket closed before ${isResume ? 'RESUMED' : 'READY'}: ${event.code}`))
        }
        if (this.closed || this.abortSignal?.aborted) return
        if (this.hasConnected) {
          this.onStatus?.('degraded', { code: 'DISCONNECTED', message: 'QQ gateway disconnected' })
          this.attemptReconnect()
        }
      })
    })
  }

  private handlePayload(payload: QQGatewayPayload, isResume: boolean, onReady: (error?: Error) => void): void {
    if (payload.s !== undefined && payload.s !== null) this.seq = payload.s
    switch (payload.op) {
      case QQ_WS_OP_CODES.HELLO:
        this.handleHello(payload.d as QQGatewayHelloData, isResume)
        break
      case QQ_WS_OP_CODES.DISPATCH:
        this.handleDispatch(payload, onReady)
        break
      case QQ_WS_OP_CODES.HEARTBEAT_ACK:
        this.heartbeatAcked = true
        this.onStatus?.('online')
        break
      case QQ_WS_OP_CODES.RECONNECT:
        this.ws?.close(4000, 'Server reconnect')
        break
      case QQ_WS_OP_CODES.INVALID_SESSION:
        if (payload.d !== true) {
          this.sessionId = null
          this.seq = null
        }
        this.ws?.close(4000, 'Invalid session')
        break
      case QQ_WS_OP_CODES.HEARTBEAT:
        this.sendHeartbeat()
        break
      default:
        this.log('Unhandled OP code: %d', payload.op)
    }
  }

  private handleHello(data: QQGatewayHelloData, isResume: boolean): void {
    const raw = data.heartbeat_interval
    const interval = Number.isFinite(raw)
      ? Math.min(Math.max(raw, HEARTBEAT_MIN_INTERVAL_MS), HEARTBEAT_MAX_INTERVAL_MS)
      : HEARTBEAT_DEFAULT_INTERVAL_MS
    this.startHeartbeat(interval)
    if (isResume && this.sessionId) this.sendResume()
    else this.sendIdentify()
  }

  private handleDispatch(payload: QQGatewayPayload, onReady: (error?: Error) => void): void {
    if (payload.t === 'READY') {
      const ready = payload.d as QQGatewayReadyData
      this.sessionId = ready.session_id
      this.resumeGatewayUrl = ready.resume_gateway_url || this.resumeGatewayUrl
      this.hasConnected = true
      this.reconnectAttempts = 0
      this.onStatus?.('online')
      onReady()
      return
    }
    if (payload.t === 'RESUMED') {
      this.hasConnected = true
      this.reconnectAttempts = 0
      this.onStatus?.('online')
      onReady()
      return
    }
    this.forwardChain = this.forwardChain.then(() => this.forwardEvent(payload)).catch((error) => {
      const normalized = error instanceof Error ? error : new Error('QQ webhook forwarding failed')
      this.onStatus?.('degraded', { code: 'WEBHOOK_FORWARD_FAILED', message: normalized.message })
      this.onForwardError?.(normalized)
    })
  }

  private sendIdentify(): void {
    void this.api.getAccessToken().then((token) => {
      this.send({
        d: {
          intents: this.intents,
          properties: { $browser: 'purechat-gateway', $device: 'purechat-gateway', $os: 'linux' },
          shard: this.shard,
          token: `QQBot ${token}`,
        },
        op: QQ_WS_OP_CODES.IDENTIFY,
      })
    }).catch((error) => {
      this.openConnectionError = error instanceof Error ? error : new Error('QQ identify failed')
      this.ws?.close(4000, 'Identify failed')
    })
  }

  private sendResume(): void {
    void this.api.getAccessToken().then((token) => {
      this.send({ d: { seq: this.seq, session_id: this.sessionId, token: `QQBot ${token}` }, op: QQ_WS_OP_CODES.RESUME })
    }).catch((error) => {
      this.openConnectionError = error instanceof Error ? error : new Error('QQ resume failed')
      this.ws?.close(4000, 'Resume failed')
    })
  }

  private sendHeartbeat(): void {
    this.send({ d: this.seq, op: QQ_WS_OP_CODES.HEARTBEAT })
  }

  private send(payload: QQGatewayPayload): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload))
  }

  private startHeartbeat(intervalMs: number): void {
    this.stopHeartbeat()
    this.heartbeatAcked = true
    this.heartbeatJitterTimer = setTimeout(() => {
      if (this.closed || this.abortSignal?.aborted) return
      this.sendHeartbeat()
      this.heartbeatTimer = setInterval(() => {
        if (!this.heartbeatAcked) {
          this.ws?.close(4000, 'Heartbeat timeout')
          return
        }
        this.heartbeatAcked = false
        this.sendHeartbeat()
      }, intervalMs)
    }, Math.random() * intervalMs)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.heartbeatJitterTimer) clearTimeout(this.heartbeatJitterTimer)
    this.heartbeatTimer = null
    this.heartbeatJitterTimer = null
  }

  private async forwardEvent(payload: QQGatewayPayload): Promise<void> {
    const body = JSON.stringify({ d: payload.d, id: payload.id || `gw_${Date.now()}`, op: 0, s: payload.s, t: payload.t })
    let lastError: unknown
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const response = await fetch(this.webhookUrl, {
          body,
          headers: { 'Content-Type': 'application/json', ...this.webhookHeaders },
          method: 'POST',
          signal: AbortSignal.timeout(30_000),
        })
        if (!response.ok) throw new Error(`QQ webhook returned ${response.status}`)
        return
      } catch (error) {
        lastError = error
        if (this.closed || this.abortSignal?.aborted) return
        if (attempt < 4) await delay(1000 * 2 ** attempt, this.abortSignal)
      }
    }
    throw lastError instanceof Error ? lastError : new Error('QQ webhook forwarding failed')
  }

  private attemptReconnect(): void {
    if (this.reconnectTimer || this.closed) return
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.settleDone(new Error('QQ gateway reconnect attempts exhausted'))
      return
    }
    this.reconnectAttempts += 1
    const timeout = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** (this.reconnectAttempts - 1), RECONNECT_MAX_DELAY_MS)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.closed || this.abortSignal?.aborted) return
      const canResume = Boolean(this.sessionId)
      const url = canResume && this.resumeGatewayUrl ? this.resumeGatewayUrl : this.gatewayUrl
      if (!url) {
        this.settleDone(new Error('QQ gateway reconnect URL is unavailable'))
        return
      }
      void this.openConnection(url, canResume).catch(() => this.attemptReconnect())
    }, timeout)
  }
}
