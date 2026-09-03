import { QQ_MSG_TYPE } from './types'
import type { QQAccessTokenResponse, QQGatewayUrlResponse, QQSendMessageParams, QQSendMessageResponse } from './types'

/** `@pure/chat-adapter/qq` 的 QQ OpenAPI 客户端，协议说明见 `docs/self-hosting/channels/qq/protocol.md`。 */

const AUTH_URL = 'https://bots.qq.com/app/getAppAccessToken'
const API_BASE_URL = 'https://api.sgroup.qq.com'
const REQUEST_TIMEOUT_MS = 15_000
const NETWORK_RETRY_COUNT = 2
const MAX_TEXT_LENGTH = 2000

export class QQApiClient {
  private readonly appId: string
  private readonly clientSecret: string
  private cachedToken?: string
  private tokenExpiresAt = 0

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastError: unknown

    for (let attempt = 0; attempt <= NETWORK_RETRY_COUNT; attempt++) {
      try {
        return await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
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

  private async call<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
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

    const response = await this.fetchWithRetry(url, init)

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
  async sendGroupMessage(
    groupOpenId: string,
    content: string,
    options?: { eventId?: string; msgId?: string; msgSeq?: number }
  ): Promise<QQSendMessageResponse> {
    const params: QQSendMessageParams = {
      content: this.truncateText(content),
      msg_type: QQ_MSG_TYPE.TEXT,
    }

    if (options?.msgId) {
      params.msg_id = options.msgId
    }
    if (options?.eventId) {
      params.event_id = options.eventId
    }
    if (options?.msgSeq !== undefined) {
      params.msg_seq = options.msgSeq
    }

    return this.call<QQSendMessageResponse>('POST', `/v2/groups/${groupOpenId}/messages`, params)
  }

  /** 向 QQ 频道的子频道发送文本消息。 */
  async sendGuildMessage(
    channelId: string,
    content: string,
    options?: { eventId?: string; msgId?: string }
  ): Promise<QQSendMessageResponse> {
    const params: QQSendMessageParams = {
      content: this.truncateText(content),
      msg_type: QQ_MSG_TYPE.TEXT,
    }

    if (options?.msgId) {
      params.msg_id = options.msgId
    }
    if (options?.eventId) {
      params.event_id = options.eventId
    }

    return this.call<QQSendMessageResponse>('POST', `/channels/${channelId}/messages`, params)
  }

  /** 向 QQ 用户发送 C2C 单聊文本消息。 */
  async sendC2CMessage(
    openId: string,
    content: string,
    options?: { eventId?: string; msgId?: string; msgSeq?: number }
  ): Promise<QQSendMessageResponse> {
    const params: QQSendMessageParams = {
      content: this.truncateText(content),
      msg_type: QQ_MSG_TYPE.TEXT,
    }

    if (options?.msgId) {
      params.msg_id = options.msgId
    }
    if (options?.eventId) {
      params.event_id = options.eventId
    }
    if (options?.msgSeq !== undefined) {
      params.msg_seq = options.msgSeq
    }

    return this.call<QQSendMessageResponse>('POST', `/v2/users/${openId}/messages`, params)
  }

  /** 向 QQ 频道私信会话（DMS）发送文本消息。 */
  async sendDmsMessage(
    guildId: string,
    content: string,
    options?: { eventId?: string; msgId?: string }
  ): Promise<QQSendMessageResponse> {
    const params: QQSendMessageParams = {
      content: this.truncateText(content),
      msg_type: QQ_MSG_TYPE.TEXT,
    }

    if (options?.msgId) {
      params.msg_id = options.msgId
    }
    if (options?.eventId) {
      params.event_id = options.eventId
    }

    return this.call<QQSendMessageResponse>('POST', `/dms/${guildId}/messages`, params)
  }

  // ==================== 富媒体（Open Platform） ====================

  /**
   * 上传群聊要发送的富媒体文件。QQ Open Platform 支持公共 URL（由 QQ 服务端抓取）
   * 或内联字节；当前仅使用 URL 方式，因为内联 Base64 需要额外的临时存储。
   * 接口返回的 `file_info` 令牌必须继续传给 `sendGroupMedia` 才能真正发送文件。
   *
   * @see https://bot.q.qq.com/wiki/develop/api-v2/server-inter/message/send-receive/rich-media.html
   */
  async uploadGroupRichMedia(
    groupOpenId: string,
    fileType: 1 | 2 | 3 | 4,
    url: string
  ): Promise<{ file_info: string; ttl?: number }> {
    return this.call<{ file_info: string; ttl?: number }>('POST', `/v2/groups/${groupOpenId}/files`, {
      file_type: fileType,
      srv_send_msg: false,
      url,
    })
  }

  /**
   * `uploadGroupRichMedia` 的 C2C（用户单聊）对应接口，
   * 请求体结构相同但路由不同。
   */
  async uploadC2CRichMedia(
    openId: string,
    fileType: 1 | 2 | 3 | 4,
    url: string
  ): Promise<{ file_info: string; ttl?: number }> {
    return this.call<{ file_info: string; ttl?: number }>('POST', `/v2/users/${openId}/files`, {
      file_type: fileType,
      srv_send_msg: false,
      url,
    })
  }

  /**
   * 向群聊发送富媒体消息。文件必须先通过 `uploadGroupRichMedia` 上传；
   * 同一条消息不能同时包含媒体和文本（`msg_type` 只能是 7（MEDIA）或 0（TEXT）），
   * 因此调用方需要将文本部分单独发送。
   */
  async sendGroupMedia(
    groupOpenId: string,
    fileInfo: string,
    options?: { eventId?: string; msgId?: string; msgSeq?: number }
  ): Promise<QQSendMessageResponse> {
    const params: QQSendMessageParams = {
      content: ' ',
      media: { file_info: fileInfo },
      msg_type: QQ_MSG_TYPE.MEDIA,
    }
    if (options?.msgId) params.msg_id = options.msgId
    if (options?.eventId) params.event_id = options.eventId
    if (options?.msgSeq !== undefined) params.msg_seq = options.msgSeq
    return this.call<QQSendMessageResponse>('POST', `/v2/groups/${groupOpenId}/messages`, params)
  }

  /** `sendGroupMedia` 的 C2C 单聊对应接口。 */
  async sendC2CMedia(
    openId: string,
    fileInfo: string,
    options?: { eventId?: string; msgId?: string; msgSeq?: number }
  ): Promise<QQSendMessageResponse> {
    const params: QQSendMessageParams = {
      content: ' ',
      media: { file_info: fileInfo },
      msg_type: QQ_MSG_TYPE.MEDIA,
    }
    if (options?.msgId) params.msg_id = options.msgId
    if (options?.eventId) params.event_id = options.eventId
    if (options?.msgSeq !== undefined) params.msg_seq = options.msgSeq
    return this.call<QQSendMessageResponse>('POST', `/v2/users/${openId}/messages`, params)
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

  private truncateText(text: string): string {
    // QQ 文本消息最多 2000 个字符；超限时保留结尾省略号。
    if (text.length > MAX_TEXT_LENGTH) {
      return text.slice(0, MAX_TEXT_LENGTH - 3) + '...'
    }
    return text
  }
}
