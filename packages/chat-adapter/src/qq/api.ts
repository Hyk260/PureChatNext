import { QQ_MSG_TYPE } from './types'
import type { QQAccessTokenResponse, QQGatewayUrlResponse, QQSendMessageParams, QQSendMessageResponse } from './types'

/** `@pure/chat-adapter/qq` 的 QQ OpenAPI 客户端，协议说明见 `docs/self-hosting/channels/qq/protocol.md`。 */

const AUTH_URL = 'https://bots.qq.com/app/getAppAccessToken'
const API_BASE_URL = 'https://api.sgroup.qq.com'
const REQUEST_TIMEOUT_MS = 15_000
const MEDIA_UPLOAD_TIMEOUT_MS = 60_000
const NETWORK_RETRY_COUNT = 2
/** QQ OpenAPI 单条文本消息硬上限（与微信 iLink 对齐）。 */
export const QQ_MAX_TEXT_LENGTH = 2000
/** 同一入站 `msg_id` 下被动回复的最大条数（含 agent 分片与代发）。 */
export const QQ_MAX_PASSIVE_REPLIES = 5
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])

type PassiveReply = { eventId?: string; msgId?: string; msgSeq?: number }
type RichMediaUpload = { file_info: string; ttl?: number }
export type RichMediaFileType = 1 | 2 | 3 | 4
export type RichMediaSource = { fileData: string; url?: never } | { fileData?: never; url: string }

/**
 * 在 `[offset, hardEnd)` 内找更自然的断点（优先换行 / 句末 / 分句 / 空白）。
 * 找不到则退回 `hardEnd`（仍会做代理对修正）。
 */
function findQQChunkEnd(text: string, offset: number, hardEnd: number): number {
  if (hardEnd >= text.length) return text.length
  // 至少保留 40% 内容，只在后半段里找断点，避免切得过碎。
  const minEnd = offset + Math.max(1, Math.ceil((hardEnd - offset) * 0.4))
  const regionStart = minEnd
  const region = text.slice(regionStart, hardEnd)
  const patterns = [
    /(?:\r\n|\n|\r)/g,
    /[。！？.!?][”’」』】）)\]]?/g,
    /[；;]/g,
    /[，,、]/g,
    /\s/g,
  ]
  for (const pattern of patterns) {
    let best = -1
    for (const match of region.matchAll(pattern)) {
      const at = match.index + match[0].length
      if (regionStart + at > offset) best = at
    }
    if (best > 0) return regionStart + best
  }
  return hardEnd
}

/**
 * 按长度切分出站文本；短文本返回单元素数组。
 * 优先在换行 / 句读处断开；切分点避开 UTF-16 代理对中间。
 */
export function chunkQQText(text: string, limit: number = QQ_MAX_TEXT_LENGTH): string[] {
  const parsed = Math.floor(Number(limit))
  const size = Number.isFinite(parsed) ? Math.max(1, parsed) : QQ_MAX_TEXT_LENGTH
  if (text.length <= size) return [text]
  const chunks: string[] = []
  for (let offset = 0; offset < text.length; ) {
    let end = findQQChunkEnd(text, offset, Math.min(offset + size, text.length))
    // 若 end 落在低代理上，说明切开了代理对，回退一位。
    if (end < text.length && end > offset && (text.charCodeAt(end) & 0xfc00) === 0xdc00) end -= 1
    if (end <= offset) end = Math.min(offset + 2, text.length)
    chunks.push(text.slice(offset, end))
    offset = end
  }
  return chunks
}

/**
 * 按 `limit` 分片，且最多保留 `maxChunks` 片；超出时截断并追加省略号。
 */
export function chunkQQTextLimited(text: string, limit: number, maxChunks: number): string[] {
  const parsed = Math.floor(Number(limit))
  const size = Number.isFinite(parsed) ? Math.max(1, parsed) : QQ_MAX_TEXT_LENGTH
  const budgetChunks = Math.max(0, Math.floor(Number(maxChunks)) || 0)
  if (budgetChunks <= 0) return []
  const chunks = chunkQQText(text, size)
  if (chunks.length <= budgetChunks) return chunks
  const budget = budgetChunks * size
  const clipped = text.length > budget ? `${text.slice(0, Math.max(0, budget - 3))}...` : text
  return chunkQQText(clipped, size).slice(0, budgetChunks)
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
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === NETWORK_RETRY_COUNT) return response
        await response.body?.cancel()
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs(response, attempt)))
      } catch (error) {
        lastError = error
        if (attempt === NETWORK_RETRY_COUNT) break
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
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
  async getAccessToken(): Promise<string> {
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
