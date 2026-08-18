/** `@pure/chat-adapter/qq` 共享的 QQ Bot OpenAPI 与 Gateway 类型。 */

/** QQ 适配器的应用凭据配置。 */
export interface QQAdapterConfig {
  /** QQ 开放平台应用 ID。 */
  appId: string
  /** QQ 开放平台客户端密钥。 */
  clientSecret: string
}

/** QQ 会话在线程中的统一标识。 */
export interface QQThreadId {
  /** 当线程对应频道子频道时使用的频道 ID。 */
  guildId?: string
  /** 群、用户或子频道的主体 ID。 */
  id: string
  /** 线程类型：群聊、频道、C2C 单聊或频道私信。 */
  type: 'group' | 'guild' | 'c2c' | 'dms'
}

/** QQ 消息作者的开放 ID 信息。 */
export interface QQAuthor {
  /** 作者的 QQ OpenID。 */
  id: string
  /** 群成员 OpenID。 */
  member_openid?: string
  /** 跨场景联合 OpenID。 */
  union_openid?: string
}

/** QQ 消息附件。 */
export interface QQAttachment {
  /** 附件 MIME 类型或 QQ 返回的类别标签。 */
  content_type: string
  /** 原始文件名。 */
  filename: string
  /** 图片或视频高度，单位为像素。 */
  height?: number
  /** 文件大小，单位为字节。 */
  size: number
  /** QQ 媒体文件 URL。 */
  url: string
  /** 图片或视频宽度，单位为像素。 */
  width?: number
}

/** QQ 引用消息信息。 */
export interface QQMessageReference {
  /** 被引用消息的 ID。 */
  message_id: string
}

/** QQ 原始消息载荷。 */
export interface QQRawMessage {
  /** 消息中的附件列表。 */
  attachments?: QQAttachment[]
  /** 消息作者。 */
  author: QQAuthor
  /** 频道子频道 ID。 */
  channel_id?: string
  /** 消息正文。 */
  content: string
  /** 群聊 OpenID。 */
  group_openid?: string
  /** 频道 ID。 */
  guild_id?: string
  /** 消息 ID。 */
  id: string
  /** 群成员信息。 */
  member?: {
    /** 加入群聊的时间。 */
    joined_at: string
    /** 群成员角色 ID 列表。 */
    roles?: string[]
  }
  /** 被提及的用户列表。 */
  mentions?: QQAuthor[]
  /** 引用消息信息。 */
  message_reference?: QQMessageReference
  /** 群聊或 C2C 消息序号。 */
  seq?: number
  /** 频道内消息序号。 */
  seq_in_channel?: string
  /** 消息时间戳。 */
  timestamp: string
}

/** QQ Webhook 或 Gateway 转发的统一载荷。 */
export interface QQWebhookPayload {
  /** 事件数据主体。 */
  d: QQWebhookEventData
  /** 载荷 ID。 */
  id: string
  /** QQ 操作码。 */
  op: number
  /** Gateway 序列号。 */
  s?: number
  /** 事件类型。 */
  t?: string
}

/** QQ Webhook 消息事件数据。 */
export interface QQWebhookEventData {
  /** 消息附件列表。 */
  attachments?: QQAttachment[]
  /** 消息作者。 */
  author?: QQAuthor
  /** 频道子频道 ID。 */
  channel_id?: string
  /** 消息正文。 */
  content?: string
  /** Webhook 地址验证用的事件时间戳。 */
  event_ts?: string
  /** 群聊 OpenID。 */
  group_openid?: string
  /** 频道 ID。 */
  guild_id?: string
  /** 消息或事件 ID。 */
  id?: string
  /** 群成员信息。 */
  member?: {
    /** 加入群聊的时间。 */
    joined_at: string
    /** 群成员角色 ID 列表。 */
    roles?: string[]
  }
  /** Webhook 地址验证返回的明文令牌。 */
  plain_token?: string
  /** 消息时间戳。 */
  timestamp?: string
}

/** QQ Webhook 地址验证数据。 */
export interface QQWebhookVerifyData {
  /** QQ 生成的事件时间戳。 */
  event_ts: string
  /** QQ 生成的明文令牌。 */
  plain_token: string
}

/** QQ Access Token 响应。 */
export interface QQAccessTokenResponse {
  /** Access Token 字符串。 */
  access_token: string
  /** Token 有效期，单位为秒。 */
  expires_in: number
}

/** QQ 发送消息请求参数。 */
export interface QQSendMessageParams {
  [key: string]: unknown
  content?: string
  /** 事件 ID，用于被动回复。 */
  event_id?: string
  /** Markdown 消息内容。 */
  markdown?: {
    content: string
  }
  /**
   * `msg_type: 7（MEDIA）` 对应的富媒体请求体。
   * `file_info` 来自 `QQApiClient` 的上传辅助方法。
   */
  media?: {
    /** 上传接口返回的文件令牌。 */
    file_info: string
  }
  /** 被动回复所引用的入站消息 ID。 */
  msg_id?: string
  /** 被动回复序号，同一入站消息的多条回复需递增。 */
  msg_seq?: number
  /** 消息类型，例如 `0`（TEXT）或 `7`（MEDIA）。 */
  msg_type: number
}

/** QQ 发送消息响应。 */
export interface QQSendMessageResponse {
  /** QQ 分配的消息 ID。 */
  id: string
  /** 消息创建时间。 */
  timestamp: string
}

/** QQ 线程类型。 */
export type QQMessageType = 'group' | 'guild' | 'c2c' | 'dms'

/** QQ 消息类型枚举。 */
export const QQ_MSG_TYPE = {
  /** ARK 模板消息。 */
  ARK: 3,
  /** EMBED 嵌入消息。 */
  EMBED: 4,
  /** Markdown 消息。 */
  MARKDOWN: 2,
  /** 富媒体消息。 */
  MEDIA: 7,
  /** 纯文本消息。 */
  TEXT: 0,
} as const

/** QQ 消息事件类型。 */
export const QQ_EVENT_TYPES = {
  /** 频道子频道中收到 @机器人的消息。 */
  AT_MESSAGE_CREATE: 'AT_MESSAGE_CREATE',
  /** C2C 单聊消息。 */
  C2C_MESSAGE_CREATE: 'C2C_MESSAGE_CREATE',
  /** 频道私信消息。 */
  DIRECT_MESSAGE_CREATE: 'DIRECT_MESSAGE_CREATE',
  /** QQ 群中收到 @机器人的消息。 */
  GROUP_AT_MESSAGE_CREATE: 'GROUP_AT_MESSAGE_CREATE',
} as const

/** QQ HTTP Webhook 操作码。 */
export const QQ_OP_CODES = {
  /** 事件分发。 */
  DISPATCH: 0,
  /** HTTP 回调确认。 */
  HTTP_CALLBACK_ACK: 12,
  /** Webhook 地址验证。 */
  VERIFY: 13,
} as const

/** WebSocket Gateway 操作码。 */
export const QQ_WS_OP_CODES = {
  /** 事件分发。 */
  DISPATCH: 0,
  /** 客户端发送心跳。 */
  HEARTBEAT: 1,
  /** 客户端身份认证。 */
  IDENTIFY: 2,
  /** 恢复已有会话。 */
  RESUME: 6,
  /** 服务端要求客户端重连。 */
  RECONNECT: 7,
  /** 当前会话无效。 */
  INVALID_SESSION: 9,
  /** 服务端发送连接参数。 */
  HELLO: 10,
  /** 服务端确认收到心跳。 */
  HEARTBEAT_ACK: 11,
} as const

/** WebSocket Gateway 事件意图位掩码。 */
export const QQ_INTENTS = {
  /** 音频操作事件。 */
  AUDIO_ACTION: 1 << 29,
  /** 频道私信事件。 */
  DIRECT_MESSAGE: 1 << 12,
  /** 论坛事件。 */
  FORUMS_EVENT: 1 << 28,
  /** 群聊和 C2C 事件。 */
  GROUP_AND_C2C_EVENT: 1 << 25,
  /** 频道成员事件。 */
  GUILD_MEMBERS: 1 << 1,
  /** 频道消息表情反应事件。 */
  GUILD_MESSAGE_REACTIONS: 1 << 10,
  /** 频道消息事件。 */
  GUILD_MESSAGES: 1 << 9,
  /** 频道基础事件。 */
  GUILDS: 1 << 0,
  /** 互动事件。 */
  INTERACTION: 1 << 26,
  /** 消息审核事件。 */
  MESSAGE_AUDIT: 1 << 27,
  /** 公共频道消息事件。 */
  PUBLIC_GUILD_MESSAGES: 1 << 30,
} as const

/** WebSocket Gateway 通用载荷结构。 */
export interface QQGatewayPayload {
  /** 事件数据主体，具体结构由操作码和事件类型决定。 */
  d: unknown
  /** Gateway 请求或事件 ID。 */
  id?: string
  /** Gateway 操作码。 */
  op: number
  /** 事件序列号。 */
  s?: number
  /** dispatch 事件类型。 */
  t?: string
}

/** Gateway Hello 载荷。 */
export interface QQGatewayHelloData {
  /** 服务端要求的心跳间隔，单位为毫秒。 */
  heartbeat_interval: number
}

/** Gateway Ready 载荷。 */
export interface QQGatewayReadyData {
  /** 用于恢复会话的 Gateway 地址。 */
  resume_gateway_url?: string
  /** 当前 Gateway 会话 ID。 */
  session_id: string
  /** 当前分片编号和分片总数。 */
  shard: [number, number]
  /** Bot 基本信息。 */
  user: { bot: boolean; id: string; username: string }
  /** Gateway 协议版本。 */
  version: number
}

/** 获取 Gateway 地址接口的响应。 */
export interface QQGatewayUrlResponse {
  /** 会话启动限制信息。 */
  session_start_limit?: {
    /** 并发启动限制。 */
    max_concurrency: number
    /** 当前剩余可启动次数。 */
    remaining: number
    /** 限制重置时间，单位为毫秒。 */
    reset_after: number
    /** 总启动次数限制。 */
    total: number
  }
  /** QQ 建议使用的分片数量。 */
  shards?: number
  /** Gateway WebSocket 地址。 */
  url: string
}
