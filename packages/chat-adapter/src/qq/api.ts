import { abortableDelay } from '@pure/utils/async'
import { QQ_MAX_TEXT_LENGTH } from '@pure/utils/qqText'
import { QQ_MSG_TYPE } from './types'
import type { QQAccessTokenResponse, QQGatewayUrlResponse, QQSendMessageParams, QQSendMessageResponse } from './types'

/** `@pure/chat-adapter/qq` 的 QQ OpenAPI 客户端，协议说明见 `docs/self-hosting/channels/qq/protocol.md`。 */

const AUTH_URL = 'https://bots.qq.com/app/getAppAccessToken'
const API_BASE_URL = 'https://api.sgroup.qq.com'
const REQUEST_TIMEOUT_MS = 15_000
const MEDIA_UPLOAD_TIMEOUT_MS = 60_000
const NETWORK_RETRY_COUNT = 2
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])

type PassiveReply = { eventId?: string; msgId?: string; msgSeq?: number }
type RichMediaUpload = { file_info: string; ttl?: number }

export type QQActiveMessageFailureKind = 'not_sent' | 'rejected' | 'unknown'

/** Failure details for a C2C push that does not use passive-reply context. */
export class QQActiveMessageError extends Error {
  constructor(
    message: string,
    readonly kind: QQActiveMessageFailureKind,
    readonly code?: number,
    readonly statusCode?: number,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'QQActiveMessageError'
  }
}

export type RichMediaFileType = 1 | 2 | 3 | 4
export type RichMediaSource = { fileData: string; url?: never } | { fileData?: never; url: string }

export class QQDeliveryError extends Error {
  constructor(readonly code: string, readonly kind: 'not_sent' | 'rejected' | 'unknown', readonly statusCode?: number) {
    super(code)
    this.name = 'QQDeliveryError'
  }
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get('retry-after'))
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(retryAfter * 1000, 30_000)
  return 500 * 2 ** attempt
}

function passiveReply(options?: PassiveReply): Pick<QQSendMessageParams, 'event_id' | 'msg_id' | 'msg_seq'> {
  const fields: Pick<QQSendMessageParams, 'event_id' | 'msg_id' | 'msg_seq'> = {}
  if (options?.msgId) fields.msg_id = options.msgId
  if (options?.eventId) fields.event_id = options.eventId
  if (options?.msgSeq !== undefined) fields.msg_seq = options.msgSeq
  return fields
}

export class QQApiClient {
  private readonly appId: string
  private readonly clientSecret: string
  private cachedToken?: string
  private tokenExpiresAt = 0

  private async fetchWithRetry(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
    let lastError: unknown

    for (let attempt = 0; attempt <= NETWORK_RETRY_COUNT; attempt++) {
      try {
        const response = await fetch(url, {
          ...init,
          signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
        })
        if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === NETWORK_RETRY_COUNT) return response
        await response.body?.cancel()
        await abortableDelay(retryDelayMs(response, attempt))
      } catch (error) {
        init.signal?.throwIfAborted()
        lastError = error
        if (attempt === NETWORK_RETRY_COUNT) break
        await abortableDelay(500 * 2 ** attempt)
      }
    }

    throw new Error(`QQ network request failed after ${NETWORK_RETRY_COUNT + 1} attempts`, {
      cause: lastError,
    })
  }

  /** 创建使用指定 QQ 应用凭据的 OpenAPI 客户端。 */
  constructor(appId: string, clientSecret: string) {
    this.appId = appId
    this.clientSecret = clientSecret
  }

  /** 获取可复用的 Access Token，并在临近过期时自动刷新。 */
  async getAccessToken(signal?: AbortSignal): Promise<string> {
    // 在有效期内复用缓存的 Access Token，避免重复请求鉴权接口。
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken
    }

    const response = await this.fetchWithRetry(AUTH_URL, {
      body: JSON.stringify({
        appId: this.appId,
        clientSecret: this.clientSecret,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`QQ auth failed: ${response.status} ${text}`)
    }

    const data = (await response.json()) as QQAccessTokenResponse

    this.cachedToken = data.access_token
    // 提前 5 分钟刷新，避免请求执行期间 Token 恰好过期。
    this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000

    return this.cachedToken
  }

  /** Speech delivery never retries a POST whose outcome could already have reached QQ. */
  private async callSpeech(path: string, body: Record<string, unknown>, signal: AbortSignal): Promise<Record<string, unknown>> {
    signal.throwIfAborted()
    let token: string
    try {
      token = await this.getAccessToken(signal)
    } catch {
      signal.throwIfAborted()
      throw new QQDeliveryError('QQ_AUTH_FAILED', 'not_sent')
    }
    let response: Response
    let responseText: string
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { Authorization: `QQBot ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })
      responseText = await response.text()
    } catch {
      throw new QQDeliveryError('QQ_DELIVERY_UNKNOWN', 'unknown')
    }
    const code = parseQQResponse(responseText).code
    if (!response.ok || (code !== undefined && code !== 0)) {
      throw new QQDeliveryError(code === undefined ? `QQ_HTTP_${response.status}` : `QQ_${code}`, 'rejected', response.status)
    }
    try {
      return JSON.parse(responseText) as Record<string, unknown>
    } catch {
      throw new QQDeliveryError('QQ_DELIVERY_UNKNOWN', 'unknown')
    }
  }

  async uploadSpeech(type: 'group' | 'c2c', id: string, audio: Buffer, signal: AbortSignal): Promise<string> {
    if (!audio.length || audio.length > 5 * 1024 * 1024) throw new QQDeliveryError('QQ_INVALID_AUDIO', 'not_sent')
    const segment = type === 'group' ? 'groups' : 'users'
    const uploaded = await this.callSpeech(`/v2/${segment}/${encodeURIComponent(id)}/files`, {
      file_type: 3, file_name: 'reply.mp3', file_data: audio.toString('base64'), srv_send_msg: false,
    }, signal)
    if (typeof uploaded.file_info !== 'string' || !uploaded.file_info) throw new QQDeliveryError('QQ_UPLOAD_INVALID', 'not_sent')
    return uploaded.file_info
  }

  async sendPassiveReply(type: 'group' | 'c2c', id: string, message: { text: string } | { fileInfo: string }, reply: PassiveReply, signal: AbortSignal): Promise<void> {
    if (!reply.msgId || !reply.msgSeq) throw new QQDeliveryError('QQ_PASSIVE_CONTEXT_MISSING', 'not_sent')
    const segment = type === 'group' ? 'groups' : 'users'
    const sent = await this.callSpeech(`/v2/${segment}/${encodeURIComponent(id)}/messages`, {
      ...('text' in message ? { content: message.text, msg_type: QQ_MSG_TYPE.TEXT } : { content: ' ', media: { file_info: message.fileInfo }, msg_type: QQ_MSG_TYPE.MEDIA }),
      ...passiveReply(reply),
    }, signal)
    if (typeof sent.id !== 'string' || !sent.id) throw new QQDeliveryError('QQ_DELIVERY_UNKNOWN', 'unknown')
  }

  private async call<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    timeoutMs = REQUEST_TIMEOUT_MS
  ): Promise<T> {
    const token = await this.getAccessToken()
    const url = `${API_BASE_URL}${path}`

    const init: RequestInit = {
      headers: {
        Authorization: `QQBot ${token}`,
        'Content-Type': 'application/json',
      },
      method,
    }

    if (body && method !== 'GET' && method !== 'DELETE') {
      init.body = JSON.stringify(body)
    }

    const response = await this.fetchWithRetry(url, init, timeoutMs)

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`QQ API ${method} ${path} failed: ${response.status} ${text}`)
    }

    // 部分接口成功时不返回响应体，因此仅在响应声明为 JSON 时解析内容。
    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      return response.json() as Promise<T>
    }

    return {} as T
  }

  /** 向 QQ 群发送文本消息；如果存在入站上下文，则附带被动回复参数。 */
  sendGroupMessage(groupOpenId: string, content: string, options?: PassiveReply): Promise<QQSendMessageResponse> {
    return this.sendText(`/v2/groups/${groupOpenId}/messages`, content, options)
  }

  /** 向 QQ 频道的子频道发送文本消息。 */
  sendGuildMessage(channelId: string, content: string, options?: PassiveReply): Promise<QQSendMessageResponse> {
    return this.sendText(`/channels/${channelId}/messages`, content, options)
  }

  /** 向 QQ 用户发送 C2C 单聊文本消息。 */
  sendC2CMessage(openId: string, content: string, options?: PassiveReply): Promise<QQSendMessageResponse> {
    return this.sendText(`/v2/users/${openId}/messages`, content, options)
  }

  /**
   * 向 QQ 用户发送不依赖入站消息上下文的 C2C 主动消息。
   * 该请求不携带 `msg_id` / `event_id`，且发送接口不自动重试，避免网络结果不确定时重复推送。
   */
  async sendC2CActiveMessage(openId: string, content: string, signal?: AbortSignal): Promise<void> {
    const recipient = openId.trim()
    if (!recipient) throw new QQActiveMessageError('QQ 推送缺少 user_openid', 'not_sent', undefined, 400)
    if (content.length > QQ_MAX_TEXT_LENGTH) {
      throw new QQActiveMessageError(`QQ 单条消息不能超过 ${QQ_MAX_TEXT_LENGTH} 个字符`, 'not_sent', undefined, 413)
    }

    let token: string
    try {
      token = await this.getAccessToken()
    } catch (error) {
      throw new QQActiveMessageError('QQ Access Token 获取失败，消息尚未发送', 'not_sent', undefined, undefined, {
        cause: error,
      })
    }

    const path = `/v2/users/${encodeURIComponent(recipient)}/messages`
    let response: Response
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        body: JSON.stringify({ content, msg_type: QQ_MSG_TYPE.TEXT }),
        headers: {
          Authorization: `QQBot ${token}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
          : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (error) {
      throw new QQActiveMessageError(
        'QQ 主动推送请求未能确认结果，请核实是否收到后再重试',
        'unknown',
        undefined,
        undefined,
        { cause: error }
      )
    }

    let responseText: string
    try {
      responseText = await response.text()
    } catch (error) {
      throw new QQActiveMessageError(
        'QQ 主动推送响应未能读取，请核实是否收到后再重试',
        'unknown',
        undefined,
        response.status,
        { cause: error }
      )
    }

    const payload = parseQQResponse(responseText)
    if (!response.ok) {
      throw new QQActiveMessageError(
        `QQ 主动推送被拒绝（HTTP ${response.status}${payload.code ? `, code ${payload.code}` : ''}）`,
        'rejected',
        payload.code,
        response.status
      )
    }
  }

  /** 向 QQ 频道私信会话（DMS）发送文本消息。 */
  sendDmsMessage(guildId: string, content: string, options?: PassiveReply): Promise<QQSendMessageResponse> {
    return this.sendText(`/dms/${guildId}/messages`, content, options)
  }

  /**
   * 发送单条文本。内容应 ≤ {@link QQ_MAX_TEXT_LENGTH}；
   * 超长分片由调用方（adapter / outbound）完成，以便正确递增 `msg_seq`。
   */
  private sendText(path: string, content: string, options?: PassiveReply): Promise<QQSendMessageResponse> {
    return this.call<QQSendMessageResponse>('POST', path, {
      content: content.length > QQ_MAX_TEXT_LENGTH ? content.slice(0, QQ_MAX_TEXT_LENGTH) : content,
      msg_type: QQ_MSG_TYPE.TEXT,
      ...passiveReply(options),
    })
  }

  // ==================== 富媒体（Open Platform） ====================

  /**
   * 上传群聊要发送的富媒体文件。支持公网 URL 或 base64 `file_data`。
   * 接口返回的 `file_info` 令牌必须继续传给 `sendGroupMedia` 才能真正发送文件。
   *
   * @see https://bot.q.qq.com/wiki/develop/api-v2/server-inter/message/send-receive/rich-media.html
   */
  uploadGroupRichMedia(
    groupOpenId: string,
    fileType: RichMediaFileType,
    source: string | RichMediaSource
  ): Promise<RichMediaUpload> {
    return this.uploadMedia(`/v2/groups/${groupOpenId}/files`, fileType, source)
  }

  /**
   * `uploadGroupRichMedia` 的 C2C（用户单聊）对应接口，
   * 请求体结构相同但路由不同。
   */
  uploadC2CRichMedia(
    openId: string,
    fileType: RichMediaFileType,
    source: string | RichMediaSource
  ): Promise<RichMediaUpload> {
    return this.uploadMedia(`/v2/users/${openId}/files`, fileType, source)
  }

  private uploadMedia(
    path: string,
    fileType: RichMediaFileType,
    source: string | RichMediaSource
  ): Promise<RichMediaUpload> {
    const resolved = typeof source === 'string' ? { url: source } : source
    return this.call<RichMediaUpload>(
      'POST',
      path,
      {
        file_type: fileType,
        srv_send_msg: false,
        ...(resolved.url !== undefined ? { url: resolved.url } : { file_data: resolved.fileData }),
      },
      MEDIA_UPLOAD_TIMEOUT_MS
    )
  }

  /**
   * 向群聊发送富媒体消息。文件必须先通过 `uploadGroupRichMedia` 上传；
   * 同一条消息不能同时包含媒体和文本（`msg_type` 只能是 7（MEDIA）或 0（TEXT）），
   * 因此调用方需要将文本部分单独发送。
   */
  sendGroupMedia(groupOpenId: string, fileInfo: string, options?: PassiveReply): Promise<QQSendMessageResponse> {
    return this.sendMedia(`/v2/groups/${groupOpenId}/messages`, fileInfo, options)
  }

  /** `sendGroupMedia` 的 C2C 单聊对应接口。 */
  sendC2CMedia(openId: string, fileInfo: string, options?: PassiveReply): Promise<QQSendMessageResponse> {
    return this.sendMedia(`/v2/users/${openId}/messages`, fileInfo, options)
  }

  private sendMedia(path: string, fileInfo: string, options?: PassiveReply): Promise<QQSendMessageResponse> {
    return this.call<QQSendMessageResponse>('POST', path, {
      content: ' ',
      media: { file_info: fileInfo },
      msg_type: QQ_MSG_TYPE.MEDIA,
      ...passiveReply(options),
    })
  }

  /** 获取用于建立持久化 WebSocket 连接的 Gateway URL。 */
  async getGatewayUrl(): Promise<QQGatewayUrlResponse> {
    return this.call<QQGatewayUrlResponse>('GET', '/gateway')
  }

  /** 获取当前 Bot 的基本信息；接口失败时返回 `null`。 */
  async getBotInfo(): Promise<{ avatar: string; id: string; username: string } | null> {
    try {
      const data = await this.call<{ avatar: string; id: string; username: string }>('GET', '/users/@me')
      return data
    } catch {
      return null
    }
  }
}

function parseQQResponse(responseText: string): { code?: number } {
  if (!responseText) return {}
  try {
    const parsed = JSON.parse(responseText) as { code?: unknown }
    return typeof parsed.code === 'number' ? { code: parsed.code } : {}
  } catch {
    return {}
  }
}
