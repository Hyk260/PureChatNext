import type { QQApiClient } from './api'
import { QQ_INTENTS, QQ_WS_OP_CODES } from './types'
import type { QQGatewayHelloData, QQGatewayPayload, QQGatewayReadyData, QQGatewayUrlResponse } from './types'

export type GatewayLogger = (message: string, ...args: unknown[]) => void

/** WebSocket Gateway 的默认空日志函数。 */
const noop: GatewayLogger = () => {}
/** 重连退避的初始等待时间。 */
const RECONNECT_BASE_DELAY_MS = 1000
/** 重连退避的最大等待时间。 */
const RECONNECT_MAX_DELAY_MS = 30_000
/** 单个连接允许的最大重连次数。 */
const MAX_RECONNECT_ATTEMPTS = 10
/** QQ 返回的心跳间隔允许的最小值。 */
const HEARTBEAT_MIN_INTERVAL_MS = 1_000
/** QQ 返回的心跳间隔允许的最大值。 */
const HEARTBEAT_MAX_INTERVAL_MS = 300_000
/** 无法读取心跳间隔时使用的默认值。 */
const HEARTBEAT_DEFAULT_INTERVAL_MS = 45_000
/** 默认订阅的事件意图：公共频道、私信以及群聊/C2C 事件。 */
const DEFAULT_INTENTS = QQ_INTENTS.PUBLIC_GUILD_MESSAGES | QQ_INTENTS.DIRECT_MESSAGE | QQ_INTENTS.GROUP_AND_C2C_EVENT

/** QQ WebSocket Gateway 连接配置。 */
export interface QQGatewayOptions {
  /** 外部取消信号；触发后会关闭连接并停止重试。 */
  abortSignal?: AbortSignal
  /** 连接持续时间，超时后主动关闭；未设置时保持连接。 */
  durationMs?: number
  /** 要订阅的 Gateway intents 位掩码。 */
  intents?: number
  /** Gateway 日志函数。 */
  log?: GatewayLogger
  /** Webhook 转发重试耗尽后的错误回调。 */
  onForwardError?: (error: Error) => void
  /** Gateway 状态变化回调。 */
  onStatus?: (status: 'online' | 'degraded', detail?: { code: string; message: string }) => void
  /** 当前分片编号和分片总数，默认使用 `[0, 1]`。 */
  shard?: [number, number]
  /** 转发事件时附加到 Webhook 请求的请求头。 */
  webhookHeaders?: Record<string, string>
  /** 接收 Gateway 事件转发请求的 Webhook 地址。 */
  webhookUrl: string
}

/** 可被 AbortSignal 中断的延迟。 */
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

/** 管理 QQ Bot Gateway 持久连接，并提供明确的就绪与终止生命周期。 */
export class QQGatewayConnection {
  /** 连接最终关闭或因不可恢复错误终止时完成的 Promise。 */
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

  /** 获取 Gateway 地址并建立连接，直到收到 READY 或 RESUMED。 */
  async connect(): Promise<void> {
    // 连接前先处理已取消或已关闭的情况，避免创建无效 WebSocket。
    if (this.abortSignal?.aborted || this.closed) {
      this.close()
      return
    }
    const gatewayInfo: QQGatewayUrlResponse = await this.api.getGatewayUrl()
    this.gatewayUrl = gatewayInfo.url
    this.log('Gateway URL: %s (shards: %d)', this.gatewayUrl, gatewayInfo.shards ?? 1)
    if (this.durationMs) {
      // 长连接由调用方限定生命周期时，到期自动关闭。
      this.durationTimer = setTimeout(() => this.close(), this.durationMs)
    }
    await this.openConnection(this.gatewayUrl, false)
  }

  /** 主动关闭 WebSocket、定时器和后续重连，并完成生命周期 Promise。 */
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
          // 单条非法载荷不应破坏整个连接，只记录并等待后续消息。
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
          // 只有已经成功连接过的会话才进入自动重连流程。
          this.onStatus?.('degraded', { code: 'DISCONNECTED', message: 'QQ gateway disconnected' })
          this.attemptReconnect()
        }
      })
    })
  }

  private handlePayload(payload: QQGatewayPayload, isResume: boolean, onReady: (error?: Error) => void): void {
    // `s` 是 Gateway 的全局序列号，恢复会话和心跳都需要使用最新值。
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
        // 服务端要求重连时关闭当前连接，由 close 事件统一调度重连。
        this.ws?.close(4000, 'Server reconnect')
        break
      case QQ_WS_OP_CODES.INVALID_SESSION:
        // `d === true` 表示仍可尝试恢复，否则丢弃旧会话状态。
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
    // 收到 Hello 后先启动心跳，再根据是否有有效会话选择恢复或重新鉴权。
    this.startHeartbeat(interval)
    if (isResume && this.sessionId) this.sendResume()
    else this.sendIdentify()
  }

  private handleDispatch(payload: QQGatewayPayload, onReady: (error?: Error) => void): void {
    if (payload.t === 'READY') {
      // READY 表示新会话建立成功，记录恢复所需的会话信息。
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
      // RESUMED 表示旧会话恢复成功，可以继续转发后续事件。
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
    // Identify 必须使用最新 Access Token，避免长时间运行时使用过期 Token。
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
    // Resume 使用上次会话的 ID 和序列号，尽量避免丢失断线期间的事件。
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
      // 首次心跳使用随机抖动，避免多个连接同时发送心跳造成瞬时峰值。
      this.heartbeatTimer = setInterval(() => {
        if (!this.heartbeatAcked) {
          // 上一个心跳未收到 ACK，认为连接不可用并主动触发重连。
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
    // 将 Gateway dispatch 事件包装成 HTTP Webhook 可处理的 op: 0 载荷。
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
        // 转发失败采用指数退避，最多尝试 5 次；取消或关闭时立即停止。
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
    // 使用指数退避限制重连频率；存在会话时优先使用恢复地址。
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
