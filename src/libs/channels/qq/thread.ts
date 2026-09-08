import type { Message, Thread } from 'chat'

export type QQThreadType = 'group' | 'guild' | 'c2c' | 'dms'

export type QQThreadId = {
  guildId?: string
  id: string
  type: QQThreadType
}

const QQ_THREAD_TYPE_LABEL: Record<QQThreadType, string> = {
  c2c: 'QQ 单聊',
  dms: 'QQ 频道私信',
  group: 'QQ 群聊',
  guild: 'QQ 频道',
}

/** 解析 QQAdapter 编码的 thread.id。格式：qq:<type>:<id>[:guildId]。 */
export function parseQQThreadId(threadId: string): QQThreadId {
  const parts = threadId.split(':')
  if (parts.length < 3 || parts[0] !== 'qq') {
    return { id: threadId, type: 'group' }
  }

  const type = parts[1] as QQThreadType
  const id = parts[2]!
  const guildId = parts[3]
  return { guildId, id, type }
}

export function resolveQQThreadType(threadId: string): QQThreadType {
  return parseQQThreadId(threadId).type
}

const QQ_PLACEHOLDER_NAMES = new Set(['unknown', 'Unknown'])

function isQQAuthorNickname(username: string, userId?: string) {
  if (!username || QQ_PLACEHOLDER_NAMES.has(username)) return false
  return !userId || username !== userId
}

/** 单条消息的发言者昵称；群聊里不能把 openid 或会话标题当成昵称。 */
export function resolveQQAuthorLabel(message: Message): string | null {
  const userId = message.author?.userId?.trim()
  const username = message.author?.userName?.trim() || message.author?.fullName?.trim()
  if (!username || !isQQAuthorNickname(username, userId)) return null
  return username
}

/** 会话标题：群/频道用线程身份，单聊才用发言者昵称。 */
export function resolveQQSessionLabel(thread: Thread, message: Message): string {
  const { id, type } = parseQQThreadId(thread.id)
  if (type === 'group') return `${QQ_THREAD_TYPE_LABEL.group} ${id}`
  if (type === 'guild') return `${QQ_THREAD_TYPE_LABEL.guild} ${id}`

  const username = message.author?.userName?.trim() || message.author?.fullName?.trim()
  if (username && !QQ_PLACEHOLDER_NAMES.has(username)) return username
  if (type === 'c2c') return `${QQ_THREAD_TYPE_LABEL.c2c} ${id}`
  return `${QQ_THREAD_TYPE_LABEL.dms} ${id}`
}

export function buildQQPlatformPayload(params: {
  attachments: Array<{ mimeType?: string; name?: string; size?: number; type?: string; url?: string }>
  authorId: string
  authorName?: string | null
  threadId: string
  threadType: QQThreadType
}): Record<string, unknown> {
  const authorName = params.authorName?.trim()
  return {
    attachments: params.attachments.map(({ mimeType, name, size, type, url }) => ({
      mimeType,
      name,
      size,
      type,
      url,
    })),
    authorId: params.authorId,
    ...(authorName && authorName !== params.authorId ? { authorName } : {}),
    threadId: params.threadId,
    threadType: params.threadType,
  }
}
