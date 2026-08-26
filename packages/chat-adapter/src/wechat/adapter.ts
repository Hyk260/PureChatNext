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
  FileUpload,
  FormattedContent,
  Logger,
  RawMessage,
  ThreadInfo,
  WebhookOptions,
} from 'chat'
import mime from 'mime'

import { WechatApiClient, WechatUploadMediaType } from './api'
import { WechatFormatConverter } from './format-converter'
import { MessageItemType, MessageState, MessageType } from './types'
import type { MessageItem, WechatAdapterConfig, WechatRawMessage, WechatThreadId } from './types'

/**
 * 从 WechatRawMessage 的 item_list 提取文本内容。
 */
function extractText(msg: WechatRawMessage): string {
  const parts: string[] = []
  for (const item of msg.item_list) {
    switch (item.type) {
      case MessageItemType.TEXT: {
        if (item.text_item?.text) parts.push(item.text_item.text)
        break
      }
      case MessageItemType.IMAGE: {
        // 图片内容通过 attachments 传递，无需文本占位
        break
      }
      case MessageItemType.VOICE: {
        // 仅包含转写文本，跳过占位符
        if (item.voice_item?.text) parts.push(item.voice_item.text)
        break
      }
      case MessageItemType.FILE: {
        parts.push(`[file: ${item.file_item?.file_name || 'unknown'}]`)
        break
      }
      case MessageItemType.VIDEO: {
        // 视频内容通过 attachments 传递，无需文本占位
        break
      }
    }
  }
  return parts.join('\n')
}

function parseOptionalNumber(value: number | string | undefined): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string' || value.trim() === '') return undefined

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * 判断消息 item 是否携带可下载的 CDN 媒体。
 */
function hasCdnMedia(item: WechatRawMessage['item_list'][number]): boolean {
  switch (item.type) {
    case MessageItemType.IMAGE: {
      return !!item.image_item?.media?.encrypt_query_param
    }
    case MessageItemType.FILE: {
      return !!item.file_item?.media?.encrypt_query_param
    }
    case MessageItemType.VOICE: {
      return !!item.voice_item?.media?.encrypt_query_param
    }
    case MessageItemType.VIDEO: {
      return !!item.video_item?.media?.encrypt_query_param
    }
    default: {
      return false
    }
  }
}

/**
 * 遍历原始微信消息，产出仅含元数据的 attachments（不下载、不解密）。
 * 供 `WechatAdapter.parseRawEvent` 使用，解析路径保持轻量；媒体字节由服务端
 * `WechatGatewayClient.extractFiles` 按需下载。
 *
 * 解析阶段只做元数据的原因：
 *   1. chat-sdk 的 `Message.toJSON` 在入队时会剥离 attachment 的 `buffer`
 *      （debounce 必走；繁忙时 queue 亦如此），提前下载的 buffer 会在序列化往返中浪费。
 *   2. 群聊中多数入站消息并非 @ 机器人 — 对 99% 情况预下载是纯 CPU/带宽浪费。
 *   3. 下载路径集中在服务端 `extractFiles` 一处，数据流更易推理。
 *
 * 此处填充的字段（type/mimeType/name/size）均在 `Message.toJSON` 白名单内，
 * 下游仍能拿到每个 attachment 的数量与描述性元数据。
 */
export function extractMediaMetadata(msg: WechatRawMessage): Attachment[] {
  const attachments: Attachment[] = []

  for (const item of msg.item_list) {
    switch (item.type) {
      case MessageItemType.IMAGE: {
        if (!item.image_item) break
        attachments.push({
          mimeType: 'image/jpeg',
          name: 'image.jpg',
          type: 'image',
          url: '',
        } as Attachment)
        break
      }
      case MessageItemType.VOICE: {
        if (!item.voice_item) break
        attachments.push({
          mimeType: 'audio/silk',
          type: 'audio',
          url: '',
        } as Attachment)
        break
      }
      case MessageItemType.FILE: {
        if (!item.file_item) break
        const fileName = item.file_item.file_name
        const fileMimeType = (fileName && mime.getType(fileName)) || 'application/octet-stream'
        attachments.push({
          mimeType: fileMimeType,
          name: fileName,
          size: parseOptionalNumber(item.file_item.len),
          type: 'file',
          url: '',
        } as Attachment)
        break
      }
      case MessageItemType.VIDEO: {
        if (!item.video_item) break
        attachments.push({
          mimeType: 'video/mp4',
          size: parseOptionalNumber(item.video_item.video_size),
          type: 'video',
          url: '',
        } as Attachment)
        break
      }
    }
  }

  return attachments
}

/**
 * 独立辅助函数：下载并解密原始微信消息中的媒体，返回带 `buffer` 的 attachments。
 * 服务端 `WechatGatewayClient.extractFiles` 的主要下载路径 — 在 chat-sdk Redis
 * 往返剥离内存 buffer 后按需物化媒体。
 *
 * 纯函数 — 无状态，接收 api client、原始消息与可选 logger。
 * 图片含级联回退（CDN 主图 → 缩略图 → 直链 URL）。
 */
type WarnFn = (message: string, ...args: unknown[]) => void

export async function downloadMediaFromRawMessage(
  api: WechatApiClient,
  msg: WechatRawMessage,
  logger?: Pick<Logger, 'warn'>
): Promise<Attachment[]> {
  const warn: WarnFn = logger?.warn?.bind(logger) ?? (() => {})
  const attachments: Attachment[] = []

  for (const item of msg.item_list) {
    try {
      switch (item.type) {
        case MessageItemType.IMAGE: {
          const attachment = await downloadImageItemFromRaw(api, item, warn)
          if (attachment) attachments.push(attachment)
          break
        }
        case MessageItemType.VOICE: {
          if (!hasCdnMedia(item) || !item.voice_item?.media) break
          const voiceBuf = await api.downloadCdnMedia(item.voice_item.media)
          attachments.push({
            buffer: voiceBuf,
            mimeType: 'audio/silk',
            type: 'audio',
            url: '',
          } as Attachment)
          break
        }
        case MessageItemType.FILE: {
          if (!hasCdnMedia(item) || !item.file_item?.media) break
          const fileBuf = await api.downloadCdnMedia(item.file_item.media)
          const fileName = item.file_item?.file_name
          const fileMimeType = (fileName && mime.getType(fileName)) || 'application/octet-stream'
          attachments.push({
            buffer: fileBuf,
            mimeType: fileMimeType,
            name: fileName,
            size: parseOptionalNumber(item.file_item?.len),
            type: 'file',
            url: '',
          } as Attachment)
          break
        }
        case MessageItemType.VIDEO: {
          if (!hasCdnMedia(item) || !item.video_item?.media) break
          const videoBuf = await api.downloadCdnMedia(item.video_item.media)
          attachments.push({
            buffer: videoBuf,
            mimeType: 'video/mp4',
            size: parseOptionalNumber(item.video_item?.video_size),
            type: 'video',
            url: '',
          } as Attachment)
          break
        }
      }
    } catch (error) {
      warn('Failed to download %s media from CDN: %s', MessageItemType[item.type], error)
    }
  }

  return attachments
}

/**
 * {@link downloadMediaFromRawMessage} 使用的图片专用辅助。级联顺序：
 *   1. CDN 主媒体（image_item.media）
 *   2. CDN 缩略图（image_item.thumb_media）
 *   3. 直链 URL（image_item.url）
 */
async function downloadImageItemFromRaw(
  api: WechatApiClient,
  item: WechatRawMessage['item_list'][number],
  warn: WarnFn
): Promise<Attachment | undefined> {
  const imageItem = item.image_item
  if (!imageItem) return undefined

  // 1. 尝试从主媒体 CDN 下载
  if (imageItem.media?.encrypt_query_param) {
    try {
      const buf = await api.downloadCdnMedia(imageItem.media, imageItem.aeskey)
      return {
        buffer: buf,
        mimeType: 'image/jpeg',
        name: 'image.jpg',
        type: 'image',
        url: '',
      } as Attachment
    } catch (error) {
      warn('CDN image download failed: %s', error)
    }
  }

  // 2. 回退到 CDN 缩略图
  if (imageItem.thumb_media?.encrypt_query_param) {
    try {
      const buf = await api.downloadCdnMedia(imageItem.thumb_media, imageItem.aeskey)
      return {
        buffer: buf,
        mimeType: 'image/jpeg',
        name: 'image.jpg',
        type: 'image',
        url: '',
      } as Attachment
    } catch (error) {
      warn('CDN thumbnail download failed: %s', error)
    }
  }

  // 3. 回退到 url 直链字段
  if (imageItem.url) {
    try {
      const response = await fetch(imageItem.url, {
        signal: AbortSignal.timeout(15_000),
      })
      if (response.ok) {
        const buf = Buffer.from(await response.arrayBuffer())
        const contentType = response.headers.get('content-type') || 'image/jpeg'
        return {
          buffer: buf,
          mimeType: contentType,
          name: 'image.jpg',
          type: 'image',
          url: '',
        } as Attachment
      }
      warn('Image url fallback failed: HTTP %d', response.status)
    } catch (error) {
      warn('Image url fallback failed: %s', error)
    }
  }

  warn('No image source available (no CDN media, no thumb, no url)')
  return undefined
}

/**
 * `WechatAdapter.postMessage` 使用的归一化出站媒体描述符。
 * 将 chat-sdk 两种 attachment 形态（Attachment vs FileUpload）合并为
 * 单一 buffer 记录，再上传至 iLink CDN。
 */
interface OutboundMediaSpec {
  buffer: Buffer
  mimeType?: string
  name?: string
  type: 'image' | 'file' | 'video' | 'audio'
}

/**
 * 从 SDK 三种来源解析 Attachment 二进制：内联 `data`、懒加载 `fetchData()` 或 `url`。
 * 均失败时返回 undefined。
 */
async function loadAttachmentBuffer(
  attachment: Attachment,
  logger?: Pick<Logger, 'warn'>
): Promise<Buffer | undefined> {
  if (attachment.data) {
    return blobOrBufferToBuffer(attachment.data)
  }
  if (typeof attachment.fetchData === 'function') {
    try {
      return await attachment.fetchData()
    } catch (error) {
      logger?.warn?.('Attachment fetchData failed: %s', error)
    }
  }
  if (attachment.url) {
    try {
      const response = await fetch(attachment.url, {
        signal: AbortSignal.timeout(15_000),
      })
      if (response.ok) {
        return Buffer.from(await response.arrayBuffer())
      }
      logger?.warn?.('Attachment url fetch failed: HTTP %d', response.status)
    } catch (error) {
      logger?.warn?.('Attachment url fetch failed: %s', error)
    }
  }
  return undefined
}

async function fileUploadToBuffer(file: FileUpload): Promise<Buffer | undefined> {
  return blobOrBufferToBuffer(file.data)
}

async function blobOrBufferToBuffer(data: Buffer | Blob | ArrayBuffer): Promise<Buffer | undefined> {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return Buffer.from(await data.arrayBuffer())
  }
  return undefined
}

/**
 * 仅有 FileUpload（无 type 字段）时，根据文件名或 mime 推断 chat-sdk Attachment.type。
 */
function inferAttachmentType(filename: string, mimeType?: string): 'image' | 'file' | 'video' | 'audio' {
  const resolvedMime = mimeType || mime.getType(filename) || ''
  if (resolvedMime.startsWith('image/')) return 'image'
  if (resolvedMime.startsWith('video/')) return 'video'
  if (resolvedMime.startsWith('audio/')) return 'audio'
  return 'file'
}

function mapToUploadMediaType(type: 'image' | 'file' | 'video' | 'audio'): WechatUploadMediaType {
  switch (type) {
    case 'image': {
      return WechatUploadMediaType.IMAGE
    }
    case 'video': {
      return WechatUploadMediaType.VIDEO
    }
    case 'audio': {
      return WechatUploadMediaType.VOICE
    }
    case 'file':
    default: {
      return WechatUploadMediaType.FILE
    }
  }
}

/**
 * 微信（iLink）适配器，@pure/chat-adapter/wechat（Vercel Chat SDK）。
 * 协议说明见 `docs/self-hosting/channels/wechat/protocol.md`。
 *
 * 处理长轮询 monitor 转发的 webhook 请求，以及通过 iLink Bot API 的消息操作。
 */
export class WechatAdapter implements Adapter<WechatThreadId, WechatRawMessage> {
  readonly name = 'wechat'
  private readonly api: WechatApiClient
  private readonly formatConverter: WechatFormatConverter
  private _userName: string
  private _botUserId?: string
  private chat!: ChatInstance
  private logger!: Logger

  /**
   * 按 thread 缓存的 contextToken。
   * 微信要求回显最近一条入站消息的 context_token。
   */
  private contextTokens = new Map<string, string>()

  get userName(): string {
    return this._userName
  }

  get botUserId(): string | undefined {
    return this._botUserId
  }

  constructor(config: WechatAdapterConfig & { userName?: string }) {
    this.api = new WechatApiClient(config.botToken, config.botId)
    this.formatConverter = new WechatFormatConverter()
    this._userName = config.userName || 'wechat-bot'
    this._botUserId = config.botId
  }

  async initialize(chat: ChatInstance): Promise<void> {
    this.chat = chat
    this.logger = chat.getLogger(this.name)
    this._userName = chat.getUserName()

    this.logger.info('Initialized WeChat adapter (botUserId=%s)', this._botUserId)
  }

  // ------------------------------------------------------------------
  // Webhook 处理 — 处理 monitor 转发的消息
  // ------------------------------------------------------------------

  async handleWebhook(request: Request, options?: WebhookOptions): Promise<Response> {
    const bodyText = await request.text()

    let msg: WechatRawMessage
    try {
      msg = JSON.parse(bodyText)
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }

    // 跳过 Bot 自身消息与未完成消息
    if (msg.message_type === MessageType.BOT) {
      return Response.json({ ok: true })
    }
    if (msg.message_state !== undefined && msg.message_state !== MessageState.FINISH) {
      return Response.json({ ok: true })
    }

    const text = extractText(msg)
    const hasMedia = msg.item_list.some(
      (item) =>
        item.type === MessageItemType.IMAGE ||
        item.type === MessageItemType.VIDEO ||
        item.type === MessageItemType.VOICE ||
        item.type === MessageItemType.FILE
    )
    if (!text.trim() && !hasMedia) {
      return Response.json({ ok: true })
    }

    // 构建 thread ID 并缓存 context token
    const threadId = this.encodeThreadId({ id: msg.from_user_id, type: 'single' })
    this.contextTokens.set(threadId, msg.context_token)

    const messageFactory = async () => this.parseRawEvent(msg, threadId, text)
    this.chat.processMessage(this, threadId, messageFactory, options)

    return Response.json({ ok: true })
  }

  // ------------------------------------------------------------------
  // 消息操作
  // ------------------------------------------------------------------

  async postMessage(threadId: string, message: AdapterPostableMessage): Promise<RawMessage<WechatRawMessage>> {
    const { id } = this.decodeThreadId(threadId)
    const text = this.formatConverter.renderPostable(message)
    const contextToken = this.contextTokens.get(threadId) || ''

    const sentItems: MessageItem[] = []

    if (text.trim()) {
      await this.api.sendMessage(id, text, contextToken)
      sentItems.push({ text_item: { text }, type: MessageItemType.TEXT })
    }

    // 按 protocol.md §6.7，媒体 item 分开发送（每次 sendmessage 一个 item）。
    // 从 postable 载荷收集 attachments + files，物化字节后逐个上传至 iLink CDN。
    const mediaSpecs = await this.collectMediaSpecs(message)
    for (const spec of mediaSpecs) {
      try {
        const item = await this.uploadAndBuildMediaItem(id, spec)
        await this.api.sendItem(id, item, contextToken)
        sentItems.push(item)
      } catch (error) {
        // 单个 attachment 失败不应中断其余 — 记录日志并继续。
        this.logger.warn('Failed to send %s attachment "%s" to WeChat: %s', spec.type, spec.name ?? '(unnamed)', error)
      }
    }

    // 若未发送任何内容，回退为空 TEXT item（保持 postMessage 始终产出 raw message 的旧行为）。
    const itemList = sentItems.length > 0 ? sentItems : [{ text_item: { text }, type: MessageItemType.TEXT }]

    return {
      id: `bot_${Date.now()}`,
      raw: {
        client_id: `purechat_${Date.now()}`,
        context_token: contextToken,
        create_time_ms: Date.now(),
        from_user_id: this._botUserId || '',
        item_list: itemList,
        message_id: 0,
        message_state: MessageState.FINISH,
        message_type: MessageType.BOT,
        to_user_id: id,
      },
      threadId,
    }
  }

  /**
   * 从 postable 消息提取 `attachments` 与 `files`（联合类型形态各异），
   * 归一化为带字节的扁平列表。
   */
  private async collectMediaSpecs(message: AdapterPostableMessage): Promise<OutboundMediaSpec[]> {
    if (typeof message === 'string') return []

    const attachments: Attachment[] = []
    const files: FileUpload[] = []

    // PostableRaw / PostableMarkdown / PostableAst 共用 `attachments` + `files` 形态。
    // PostableCard 仅含 `files`；CardElement 两者皆无。
    if ('attachments' in message && Array.isArray(message.attachments)) {
      attachments.push(...message.attachments)
    }
    if ('files' in message && Array.isArray(message.files)) {
      files.push(...message.files)
    }

    const specs: OutboundMediaSpec[] = []

    for (const attachment of attachments) {
      const buffer = await loadAttachmentBuffer(attachment, this.logger)
      if (!buffer) continue
      specs.push({
        buffer,
        mimeType: attachment.mimeType,
        name: attachment.name,
        type: attachment.type,
      })
    }

    for (const file of files) {
      const buffer = await fileUploadToBuffer(file)
      if (!buffer) continue
      specs.push({
        buffer,
        mimeType: file.mimeType,
        name: file.filename,
        type: inferAttachmentType(file.filename, file.mimeType),
      })
    }

    return specs
  }

  /**
   * 将单个媒体 buffer 上传至 iLink CDN，构建对应 MessageItem，
   * 经 {@link WechatApiClient.sendItem} 发送。
   */
  private async uploadAndBuildMediaItem(toUserId: string, spec: OutboundMediaSpec): Promise<MessageItem> {
    const mediaType = mapToUploadMediaType(spec.type)
    const result = await this.api.uploadCdnMedia(toUserId, mediaType, spec.buffer)
    const cdnMedia = {
      aes_key: result.aesKey,
      encrypt_query_param: result.encryptQueryParam,
      encrypt_type: 1 as const,
    }

    switch (mediaType) {
      case WechatUploadMediaType.IMAGE: {
        return {
          image_item: { media: cdnMedia },
          type: MessageItemType.IMAGE,
        }
      }
      case WechatUploadMediaType.VIDEO: {
        return {
          type: MessageItemType.VIDEO,
          video_item: { media: cdnMedia, video_size: result.cipherSize },
        }
      }
      case WechatUploadMediaType.VOICE: {
        return {
          type: MessageItemType.VOICE,
          voice_item: { media: cdnMedia },
        }
      }
      case WechatUploadMediaType.FILE:
      default: {
        return {
          file_item: {
            file_name: spec.name,
            len: String(spec.buffer.length),
            media: cdnMedia,
          },
          type: MessageItemType.FILE,
        }
      }
    }
  }

  async editMessage(
    threadId: string,
    _messageId: string,
    message: AdapterPostableMessage
  ): Promise<RawMessage<WechatRawMessage>> {
    // 微信不支持编辑 — 回退为发送新消息
    return this.postMessage(threadId, message)
  }

  async deleteMessage(_threadId: string, _messageId: string): Promise<void> {
    this.logger.warn('Message deletion not supported for WeChat')
  }

  async fetchMessages(_threadId: string, _options?: FetchOptions): Promise<FetchResult<WechatRawMessage>> {
    return { messages: [], nextCursor: undefined }
  }

  async fetchThread(threadId: string): Promise<ThreadInfo> {
    const { type, id } = this.decodeThreadId(threadId)
    return {
      channelId: threadId,
      id: threadId,
      isDM: type === 'single',
      metadata: { id, type },
    }
  }

  // ------------------------------------------------------------------
  // 消息解析
  // ------------------------------------------------------------------

  parseMessage(raw: WechatRawMessage): Message<WechatRawMessage> {
    const text = extractText(raw)
    const formatted = parseMarkdown(text)
    const threadId = this.encodeThreadId({ id: raw.from_user_id, type: 'single' })

    // 此处不含 attachments — 本方法与 `parseRawEvent` 均不再下载媒体。
    // 服务端 `WechatGatewayClient.extractFiles` 为唯一下载路径；按需遍历 `message.raw.item_list`。
    return new Message({
      attachments: [],
      author: {
        fullName: raw.from_user_id,
        isBot: raw.message_type === MessageType.BOT,
        isMe: raw.message_type === MessageType.BOT,
        userId: raw.from_user_id,
        userName: raw.from_user_id,
      },
      formatted,
      id: String(raw.message_id || 0),
      metadata: {
        dateSent: new Date(raw.create_time_ms || Date.now()),
        edited: false,
      },
      raw,
      text,
      threadId,
    })
  }

  private parseRawEvent(msg: WechatRawMessage, threadId: string, text: string): Message<WechatRawMessage> {
    const formatted = parseMarkdown(text)

    // 仅元数据 attachments — 实际二进制由服务端 `WechatGatewayClient.extractFiles` 按需下载。
    // 不在此预下载的原因见 `extractMediaMetadata`。
    const attachments = extractMediaMetadata(msg)

    const author: Author = {
      fullName: msg.from_user_id,
      isBot: false,
      isMe: false,
      userId: msg.from_user_id,
      userName: msg.from_user_id,
    }

    return new Message({
      attachments,
      author,
      formatted,
      id: String(msg.message_id || 0),
      metadata: {
        dateSent: new Date(msg.create_time_ms || Date.now()),
        edited: false,
      },
      raw: msg,
      text,
      threadId,
    })
  }

  // ------------------------------------------------------------------
  // 反应与正在输入（能力有限）
  // ------------------------------------------------------------------

  async addReaction(_threadId: string, _messageId: string, _emoji: EmojiValue | string): Promise<void> {}

  async removeReaction(_threadId: string, _messageId: string, _emoji: EmojiValue | string): Promise<void> {}

  async startTyping(threadId: string): Promise<void> {
    const { id } = this.decodeThreadId(threadId)
    const contextToken = this.contextTokens.get(threadId)
    if (!contextToken) return
    await this.api.startTyping(id, contextToken)
  }

  // ------------------------------------------------------------------
  // Thread ID 编码
  // ------------------------------------------------------------------

  encodeThreadId(data: WechatThreadId): string {
    return `wechat:${data.type}:${data.id}`
  }

  decodeThreadId(threadId: string): WechatThreadId {
    const parts = threadId.split(':')
    if (parts.length < 3 || parts[0] !== 'wechat') {
      return { id: threadId, type: 'single' }
    }
    return { id: parts.slice(2).join(':'), type: parts[1] as WechatThreadId['type'] }
  }

  channelIdFromThreadId(threadId: string): string {
    return threadId
  }

  isDM(threadId: string): boolean {
    const { type } = this.decodeThreadId(threadId)
    return type === 'single'
  }

  // ------------------------------------------------------------------
  // 格式渲染
  // ------------------------------------------------------------------

  renderFormatted(content: FormattedContent): string {
    return this.formatConverter.fromAst(content)
  }

  // ------------------------------------------------------------------
  // context_token 管理（公开供平台客户端使用）
  // ------------------------------------------------------------------

  getContextToken(threadId: string): string | undefined {
    return this.contextTokens.get(threadId)
  }

  setContextToken(threadId: string, token: string): void {
    this.contextTokens.set(threadId, token)
  }
}

/** 创建 WechatAdapter 的工厂函数。 */
export function createWechatAdapter(config: WechatAdapterConfig & { userName?: string }): WechatAdapter {
  return new WechatAdapter(config)
}
