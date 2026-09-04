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

export function resolveQQSessionLabel(thread: Thread, message: Message): string {
  const { id, type } = parseQQThreadId(thread.id)
  const authorId = message.author?.userId || id
  if (type === 'group') return `${QQ_THREAD_TYPE_LABEL.group} ${id}`
  if (type === 'c2c') return `${QQ_THREAD_TYPE_LABEL.c2c} ${authorId}`
  if (type === 'dms') return `${QQ_THREAD_TYPE_LABEL.dms} ${id}`
  return `${QQ_THREAD_TYPE_LABEL.guild} ${id}`
}

export function buildQQPlatformPayload(params: {
  attachments: Array<{ mimeType?: string; name?: string; size?: number; type?: string; url?: string }>
  authorId: string
  threadId: string
  threadType: QQThreadType
}): Record<string, unknown> {
  return {
    attachments: params.attachments.map(({ mimeType, name, size, type, url }) => ({
      mimeType,
      name,
      size,
      type,
      url,
    })),
    authorId: params.authorId,
    threadId: params.threadId,
    threadType: params.threadType,
  }
}
