import { Message, parseMarkdown } from 'chat'
import type {
  Adapter,
  AdapterPostableMessage,
  Attachment,
  Author,
  ChatInstance,
  EmojiValue,
  FetchOptions,
  FetchResult,
  FormattedContent,
  Logger,
  RawMessage,
  ThreadInfo,
  WebhookOptions,
} from 'chat'
import mime from 'mime'
import { resolveMimeTypeFromBytes } from '@pure/utils'

import { QQApiClient } from './api'
import { signWebhookResponse } from './crypto'
import { QQFormatConverter } from './format-converter'
import { QQGatewayConnection } from './gateway'
import { QQ_EVENT_TYPES, QQ_OP_CODES } from './types'
import type {
  QQAdapterConfig,
  QQAttachment,
  QQRawMessage,
  QQThreadId,
  QQWebhookEventData,
  QQWebhookPayload,
} from './types'

/** QQ 被动回复窗口所需的入站 `msg_id` 和消息序号。 */
type PendingReplyContext = {
  msgId: string
  msgSeq: number
}

/** `@pure/chat-adapter/qq` 的 QQ Bot 适配器（Vercel Chat SDK）。 */
export class QQAdapter implements Adapter<QQThreadId, QQRawMessage> {
  readonly name = 'qq'
  private readonly api: QQApiClient
  private readonly clientSecret: string
  private readonly formatConverter: QQFormatConverter
  private _userName: string
  private _botUserId?: string
  private chat!: ChatInstance
  private logger!: Logger
  /** `threadId` → 最近一条入站消息的上下文，用于发送被动回复。 */
  private readonly replyContext = new Map<string, PendingReplyContext>()

  /** 返回当前 Bot 的显示名称。 */
  get userName(): string {
    return this._userName
  }

  /** 返回初始化阶段获取到的 Bot 用户 ID。 */
  get botUserId(): string | undefined {
    return this._botUserId
  }

  /** 创建 QQ 适配器，并初始化 OpenAPI 客户端和格式转换器。 */
  constructor(config: QQAdapterConfig & { userName?: string }) {
    this.api = new QQApiClient(config.appId, config.clientSecret)
    this.clientSecret = config.clientSecret
    this.formatConverter = new QQFormatConverter()
    this._userName = config.userName || 'qq-bot'
  }

  /** 注入 Chat SDK 实例，验证凭据并尽力获取 Bot 基本信息。 */
  async initialize(chat: ChatInstance): Promise<void> {
    this.chat = chat
    this.logger = chat.getLogger(this.name)
    this._userName = chat.getUserName()

    // 通过获取 Access Token 验证应用凭据是否有效。
    await this.api.getAccessToken()

    // 尝试获取机器人信息；失败不影响适配器继续工作。
    try {
      const botInfo = await this.api.getBotInfo()
      if (botInfo) {
        if (botInfo.username) this._userName = botInfo.username
        if (botInfo.id) this._botUserId = botInfo.id
      }
    } catch {
      // 机器人信息不是初始化所必需的。
    }

    this.logger.info('Initialized QQ adapter (botUserId=%s)', this._botUserId)
  }

  // ------------------------------------------------------------------
  // Webhook 处理
  // ------------------------------------------------------------------

  /** 校验并处理 QQ Webhook 请求，将消息事件交给 Chat SDK。 */
  async handleWebhook(request: Request, options?: WebhookOptions): Promise<Response> {
    const bodyText = await request.text()

    let payload: QQWebhookPayload
    try {
      payload = JSON.parse(bodyText)
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }

    // 处理 Webhook 地址验证（op: 13）。
    if (payload.op === QQ_OP_CODES.VERIFY) {
      const verifyData = payload.d as { event_ts: string; plain_token: string }
      if (verifyData.plain_token && verifyData.event_ts) {
        const signature = signWebhookResponse(verifyData.event_ts, verifyData.plain_token, this.clientSecret)
        return Response.json({
          plain_token: verifyData.plain_token,
          signature,
        })
      }
      return new Response('Missing verification data', { status: 400 })
    }

    // 处理事件分发载荷（op: 0）；其他操作码直接确认即可。
    if (payload.op !== QQ_OP_CODES.DISPATCH) {
      return Response.json({ ok: true })
    }

    const eventType = payload.t
    const eventData = payload.d

    // 目前只处理消息事件，其他事件交由调用方忽略。
    if (!this.isMessageEvent(eventType)) {
      return Response.json({ ok: true })
    }

    // 提取消息内容；即使没有文本，只要包含附件也必须继续处理。
    const content = eventData.content
    const hasAttachments = eventData.attachments && eventData.attachments.length > 0
    if (!content?.trim() && !hasAttachments) {
      return Response.json({ ok: true })
    }

    // 根据事件类型构造统一的 thread ID。
    const threadId = this.buildThreadId(eventType, eventData)
    if (!threadId) {
      return Response.json({ ok: true })
    }

    // 记住入站 `msg_id`，让后续 `postMessage` 能发送被动回复。
    if (eventData.id) {
      this.replyContext.set(threadId, { msgId: eventData.id, msgSeq: 1 })
    }

    // 通过延迟执行的工厂函数创建 Chat SDK 消息对象。
    const messageFactory = () => this.parseRawEvent(eventData, threadId, eventType!)

    // 将消息交给 Chat SDK 的标准处理流水线。
    this.chat.processMessage(this, threadId, messageFactory, options)

    return Response.json({ ok: true })
  }

  private isMessageEvent(eventType?: string): boolean {
    if (!eventType) return false
    return (
      eventType === QQ_EVENT_TYPES.GROUP_AT_MESSAGE_CREATE ||
      eventType === QQ_EVENT_TYPES.C2C_MESSAGE_CREATE ||
      eventType === QQ_EVENT_TYPES.AT_MESSAGE_CREATE ||
      eventType === QQ_EVENT_TYPES.DIRECT_MESSAGE_CREATE
    )
  }

  private buildThreadId(eventType: string | undefined, data: QQWebhookEventData): string | null {
    if (!eventType) return null

    switch (eventType) {
      case QQ_EVENT_TYPES.GROUP_AT_MESSAGE_CREATE: {
        if (!data.group_openid) return null
        return this.encodeThreadId({ id: data.group_openid, type: 'group' })
      }
      case QQ_EVENT_TYPES.C2C_MESSAGE_CREATE: {
        if (!data.author?.id) return null
        return this.encodeThreadId({ id: data.author.id, type: 'c2c' })
      }
      case QQ_EVENT_TYPES.AT_MESSAGE_CREATE: {
        if (!data.channel_id) return null
        return this.encodeThreadId({
          guildId: data.guild_id,
          id: data.channel_id,
          type: 'guild',
        })
      }
      case QQ_EVENT_TYPES.DIRECT_MESSAGE_CREATE: {
        if (!data.guild_id) return null
        return this.encodeThreadId({ id: data.guild_id, type: 'dms' })
      }
      default: {
        return null
      }
    }
  }

  // ------------------------------------------------------------------
  // Gateway 监听器（WebSocket 模式）
  // ------------------------------------------------------------------

  /**
   * 启动持久化的 WebSocket Gateway 连接。
   * Gateway 收到的事件会以 HTTP POST 转发到 `webhookUrl`，
   * 从而复用现有的 `handleWebhook()` 处理流水线。
   */
  async startGatewayListener(
    options: { waitUntil: (task: Promise<unknown>) => void },
    durationMs: number | undefined,
    abortSignal: AbortSignal,
    webhookUrl: string,
    webhookHeaders?: Record<string, string>,
    callbacks?: Pick<import('./gateway').QQGatewayOptions, 'onForwardError' | 'onStatus'>
  ): Promise<QQGatewayConnection> {
    const gateway = new QQGatewayConnection(this.api, {
      abortSignal,
      durationMs,
      log: (msg: string, ...rest: unknown[]) => this.logger.info(msg, ...rest),
      ...callbacks,
      webhookHeaders,
      webhookUrl,
    })

    const gatewayTask = gateway.connect()
    options.waitUntil(gatewayTask)
    await gatewayTask
    return gateway
  }

  // ------------------------------------------------------------------
  // 消息操作
  // ------------------------------------------------------------------

  /** 根据线程类型发送消息，并返回 Chat SDK 所需的原始消息包装。 */
  async postMessage(threadId: string, message: AdapterPostableMessage): Promise<RawMessage<QQRawMessage>> {
    const { type, id, guildId } = this.decodeThreadId(threadId)
    const text = this.formatConverter.renderPostable(message)
    const replyOpts = this.consumeReplyOptions(threadId)

    let response
    switch (type) {
      case 'group': {
        response = await this.api.sendGroupMessage(id, text, replyOpts)
        break
      }
      case 'guild': {
        response = await this.api.sendGuildMessage(id, text, replyOpts)
        break
      }
      case 'c2c': {
        response = await this.api.sendC2CMessage(id, text, replyOpts)
        break
      }
      case 'dms': {
        response = await this.api.sendDmsMessage(guildId || id, text, replyOpts)
        break
      }
      default: {
        throw new Error(`Unknown thread type: ${type}`)
      }
    }

    return {
      id: response.id,
      raw: {
        author: { id: this._botUserId || '' },
        content: text,
        id: response.id,
        timestamp: response.timestamp,
      } as QQRawMessage,
      threadId,
    }
  }

  /**
   * Take passive-reply options for this thread.
   * Increments msg_seq so multiple outbound messages in the same window stay valid.
   */
  private consumeReplyOptions(threadId: string): { msgId?: string; msgSeq?: number } | undefined {
    const ctx = this.replyContext.get(threadId)
    if (!ctx?.msgId) return undefined

    const msgSeq = ctx.msgSeq
    this.replyContext.set(threadId, { msgId: ctx.msgId, msgSeq: msgSeq + 1 })
    return { msgId: ctx.msgId, msgSeq }
  }

  /** 编辑消息；QQ 不支持原地编辑时退化为发送新消息。 */
  async editMessage(
    threadId: string,
    _messageId: string,
    message: AdapterPostableMessage
  ): Promise<RawMessage<QQRawMessage>> {
    // QQ 暂不支持编辑消息，因此退化为重新发送一条新消息。
    return this.postMessage(threadId, message)
  }

  /** 删除消息；当前 QQ Bot API 不支持该操作，因此仅记录警告。 */
  async deleteMessage(_threadId: string, _messageId: string): Promise<void> {
    // TODO：如果 QQ API 提供撤回接口，再实现消息撤回。
    this.logger.warn('Message deletion not implemented for QQ')
  }

  /** 查询线程历史消息；QQ Bot API 不提供历史消息接口，因此返回空结果。 */
  async fetchMessages(_threadId: string, _options?: FetchOptions): Promise<FetchResult<QQRawMessage>> {
    // QQ Bot API 不提供机器人消息历史查询接口。
    return {
      messages: [],
      nextCursor: undefined,
    }
  }

  /** 根据线程 ID 构造 Chat SDK 的线程信息。 */
  async fetchThread(threadId: string): Promise<ThreadInfo> {
    const { type, id } = this.decodeThreadId(threadId)

    return {
      channelId: threadId,
      id: threadId,
      isDM: type === 'c2c' || type === 'dms',
      metadata: { id, type },
    }
  }

  // ------------------------------------------------------------------
  // 消息解析
  // ------------------------------------------------------------------

  /** 将 QQ 原始消息转换为 Chat SDK 的标准消息对象。 */
  parseMessage(raw: QQRawMessage): Message<QQRawMessage> {
    const cleanText = this.formatConverter.cleanMentions(raw.content || '')
    const formatted = parseMarkdown(cleanText)

    let threadId: string
    if (raw.group_openid) {
      threadId = this.encodeThreadId({ id: raw.group_openid, type: 'group' })
    } else if (raw.channel_id) {
      threadId = this.encodeThreadId({
        guildId: raw.guild_id,
        id: raw.channel_id,
        type: 'guild',
      })
    } else {
      threadId = this.encodeThreadId({ id: raw.author.id, type: 'c2c' })
    }

    const attachments = this.mapQQAttachments(raw.attachments)
    return new Message({
      attachments,
      author: {
        fullName: 'Unknown',
        isBot: false,
        isMe: false,
        userId: raw.author.id,
        userName: 'unknown',
      },
      formatted,
      id: raw.id,
      metadata: {
        dateSent: new Date(raw.timestamp),
        edited: false,
      },
      raw,
      text: cleanText,
      threadId,
    })
  }

  private async parseRawEvent(
    data: QQWebhookEventData,
    threadId: string,
    _eventType: string
  ): Promise<Message<QQRawMessage>> {
    const content = data.content || ''
    const cleanText = this.formatConverter.cleanMentions(content)
    const formatted = parseMarkdown(cleanText)

    const authorId = data.author?.id || 'unknown'
    // Webhook 消息事件来自用户，而不是机器人自身。
    const isBot = false

    const author: Author = {
      fullName: authorId,
      isBot,
      isMe: isBot && authorId === this._botUserId,
      userId: authorId,
      userName: authorId,
    }

    const raw: QQRawMessage = {
      attachments: data.attachments,
      author: data.author || { id: 'unknown' },
      channel_id: data.channel_id,
      content,
      group_openid: data.group_openid,
      guild_id: data.guild_id,
      id: data.id || '',
      timestamp: data.timestamp || new Date().toISOString(),
    }

    const attachments = this.mapQQAttachments(data.attachments)

    return new Message({
      attachments,
      author,
      formatted,
      id: data.id || '',
      metadata: {
        dateSent: new Date(data.timestamp || Date.now()),
        edited: false,
      },
      raw,
      text: cleanText,
      threadId,
    })
  }

  // ------------------------------------------------------------------
  // 附件映射
  // ------------------------------------------------------------------

  /**
   * 将 QQ 附件转换为 Chat SDK 的 `Attachment` 对象。
   * QQ 会为媒体文件提供可直接访问的 URL。
   *
   * 元数据阶段使用声明值（content_type + 文件名）推断 MIME；
   * 真正下载时会基于字节魔数做二次校验（见 fetchAttachmentData）。
   */
  private mapQQAttachments(qqAttachments?: QQAttachment[]): Attachment[] {
    if (!qqAttachments || qqAttachments.length === 0) return []

    return qqAttachments.map((a) => {
      // QQ 的 `content_type` 不一定是真实的 MIME 类型：C2C 文件附件可能只返回
      // 粗粒度的 `"file"`。如果原样使用，会把 `.m4a` 错判为 `"file"` 而不是
      // `audio/mp4`，也会绕过 `ingestAttachment` 基于文件名的 MIME 类型恢复。
      // 因此，当 `content_type` 不可用时，回退到文件名推断类型。
      const declaredMimeType = this.resolveMimeType(a.content_type, a.filename)
      return {
        fetchData: () => this.fetchAttachmentData(a.url, declaredMimeType, a.filename),
        height: a.height,
        mimeType: declaredMimeType,
        name: a.filename,
        size: a.size,
        type: this.resolveAttachmentType(declaredMimeType),
        url: a.url,
        width: a.width,
      } as Attachment
    })
  }

  /**
   * 从 QQ 的 `content_type` 解析可用的 MIME 类型（声明值，仅做元数据推断）。
   * 当 QQ 返回 `"file"` 等非 MIME 值时，回退到根据文件名推断类型。
   */
  private resolveMimeType(contentType: string | undefined, filename?: string): string {
    if (contentType && contentType.includes('/')) return contentType
    return (filename && mime.getType(filename)) || 'application/octet-stream'
  }

  private resolveAttachmentType(contentType: string): 'image' | 'video' | 'audio' | 'file' {
    if (contentType.startsWith('image/')) return 'image'
    if (contentType.startsWith('video/')) return 'video'
    if (contentType.startsWith('audio/')) return 'audio'
    return 'file'
  }

  /**
   * 下载 QQ 附件数据，并基于字节魔数检测 MIME 类型真实性。
   *
   * 注意：Attachment 的 mimeType/type 在 mapQQAttachments 构造时已定死，
   * fetchData 惰性调用无法回写元数据，因此这里仅做「观测告警」——
   * 当字节检测与声明值不一致时打 warn，帮助运营发现平台元数据被伪造/错误标记，
   * 不会中断返回的 buffer（元数据仍以声明值为准）。
   */
  private async fetchAttachmentData(
    url: string,
    declaredMimeType?: string,
    filename?: string
  ): Promise<Buffer> {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) {
      throw new Error(`Failed to fetch QQ attachment: ${response.status}`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    const detectedMime = await resolveMimeTypeFromBytes(declaredMimeType ?? null, buffer)
    if (
      declaredMimeType &&
      detectedMime !== 'application/octet-stream' &&
      detectedMime !== declaredMimeType
    ) {
      this.logger.warn(
        'QQ attachment MIME mismatch: declared=%s detected=%s filename=%s url=%s',
        declaredMimeType,
        detectedMime,
        filename ?? '<unknown>',
        url
      )
    }
    return buffer
  }

  // ------------------------------------------------------------------
  // 表情反应（QQ Bot API 不支持）
  // ------------------------------------------------------------------

  /** 添加表情反应；QQ Bot API 当前不支持该操作。 */
  async addReaction(_threadId: string, _messageId: string, _emoji: EmojiValue | string): Promise<void> {
    // QQ Bot API 不支持添加表情反应。
  }

  /** 移除表情反应；QQ Bot API 当前不支持该操作。 */
  async removeReaction(_threadId: string, _messageId: string, _emoji: EmojiValue | string): Promise<void> {
    // QQ Bot API 不支持移除表情反应。
  }

  // ------------------------------------------------------------------
  // 正在输入状态（QQ Bot API 不支持）
  // ------------------------------------------------------------------

  /** 开始输入提示；QQ Bot API 当前没有对应接口。 */
  async startTyping(_threadId: string): Promise<void> {
    // QQ 没有面向 Bot 的正在输入状态接口。
  }

  // ------------------------------------------------------------------
  // Thread ID 编解码
  // ------------------------------------------------------------------

  /** 将 QQ 线程结构编码为持久化的字符串 ID。 */
  encodeThreadId(data: QQThreadId): string {
    if (data.guildId) {
      return `qq:${data.type}:${data.id}:${data.guildId}`
    }
    return `qq:${data.type}:${data.id}`
  }

  /** 将字符串线程 ID 解码为 QQ 线程结构。 */
  decodeThreadId(threadId: string): QQThreadId {
    const parts = threadId.split(':')
    if (parts.length < 3 || parts[0] !== 'qq') {
      // 格式错误时回退为群聊线程，保持 Adapter 接口可继续处理。
      return { id: threadId, type: 'group' }
    }

    const type = parts[1] as QQThreadId['type']
    const id = parts[2]
    const guildId = parts[3]

    return { guildId, id, type }
  }

  /** 返回 Chat SDK 所需的频道 ID；QQ 直接使用线程 ID 作为频道 ID。 */
  channelIdFromThreadId(threadId: string): string {
    return threadId
  }

  /** 判断线程是否属于 C2C 单聊或频道私信。 */
  isDM(threadId: string): boolean {
    const { type } = this.decodeThreadId(threadId)
    return type === 'c2c' || type === 'dms'
  }

  // ------------------------------------------------------------------
  // 格式渲染
  // ------------------------------------------------------------------

  /** 将 Chat SDK 的格式化内容渲染为 QQ 可发送的文本。 */
  renderFormatted(content: FormattedContent): string {
    return this.formatConverter.fromAst(content)
  }
}

/** 创建 QQ 适配器实例的工厂函数。 */
export function createQQAdapter(config: QQAdapterConfig & { userName?: string }): QQAdapter {
  return new QQAdapter(config)
}
