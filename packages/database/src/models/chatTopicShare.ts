import { and, asc, eq } from 'drizzle-orm'
import type { UIMessage } from 'ai'

import { getServerDB } from '../core/db-adaptor'
import { agents, chatMessages, chatTopicShares, chatTopics } from '../schemas'
import type { ChatDatabase } from '../type'

const toPublicUIMessage = (row: typeof chatMessages.$inferSelect): UIMessage | undefined => {
  const partsText = Array.isArray(row.parts)
    ? row.parts
        .map((part) => {
          if (!part || typeof part !== 'object' || !('type' in part) || !('text' in part)) return ''
          return part.type === 'text' && typeof part.text === 'string' ? part.text : ''
        })
        .join('')
    : ''
  const text = partsText || row.content || ''

  if (!text) return undefined
  return { id: row.id, parts: [{ text, type: 'text' }], role: row.role as UIMessage['role'] }
}

export type PublicChatTopicShare = {
  agent: { avatar: string | null; title: string }
  messages: UIMessage[]
  shareId: string
  title: string
}

export class ChatTopicShareModel {
  private readonly db: ChatDatabase
  private readonly userId: string

  constructor(userId: string, db: ChatDatabase = getServerDB()) {
    this.userId = userId
    this.db = db
  }

  create = async (topicId: string) => {
    const topic = await this.db.query.chatTopics.findFirst({
      where: and(eq(chatTopics.id, topicId), eq(chatTopics.userId, this.userId)),
    })
    if (!topic) return undefined

    const [created] = await this.db
      .insert(chatTopicShares)
      .values({ topicId, userId: this.userId })
      .onConflictDoNothing({ target: chatTopicShares.topicId })
      .returning()

    if (created) return created
    return this.getByTopicId(topicId)
  }

  private getByTopicId = async (topicId: string) => {
    const [share] = await this.db
      .select()
      .from(chatTopicShares)
      .where(and(eq(chatTopicShares.topicId, topicId), eq(chatTopicShares.userId, this.userId)))
      .limit(1)
    return share
  }

  static getPublicByShareId = async (shareId: string, db: ChatDatabase = getServerDB()) => {
    const [share] = await db
      .select({
        agentAvatar: agents.avatar,
        agentTitle: agents.title,
        shareId: chatTopicShares.id,
        title: chatTopics.title,
        topicId: chatTopics.id,
        visibility: chatTopicShares.visibility,
      })
      .from(chatTopicShares)
      .innerJoin(chatTopics, eq(chatTopicShares.topicId, chatTopics.id))
      .leftJoin(agents, eq(chatTopics.agentId, agents.id))
      .where(eq(chatTopicShares.id, shareId))
      .limit(1)

    if (!share || share.visibility !== 'link') return undefined

    const rows = await db.query.chatMessages.findMany({
      where: eq(chatMessages.topicId, share.topicId),
      orderBy: [asc(chatMessages.createdAt)],
    })

    return {
      agent: { avatar: share.agentAvatar, title: share.agentTitle ?? 'PureChat' },
      messages: rows.map(toPublicUIMessage).filter((message): message is UIMessage => Boolean(message)),
      shareId: share.shareId,
      title: share.title,
    } satisfies PublicChatTopicShare
  }
}
