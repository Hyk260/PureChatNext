import type { UIMessage } from 'ai'
import { and, asc, eq, sql } from 'drizzle-orm'

import type { ChatMessageMetadata } from '@pure/types'

import { getServerDB } from '../core/db-adaptor'
import { chatMessages, chatTopics } from '../schemas/chat'
import type { ChatMessageItem } from '../schemas/chat'
import type { ChatDatabase } from '../type'

import { ChatTopicModel } from './chatTopic'

const rowToUIMessage = (row: ChatMessageItem): UIMessage => {
  const storedMetadata = row.metadata ?? undefined
  const metadata: ChatMessageMetadata | undefined =
    storedMetadata || row.model || row.provider
      ? {
          ...storedMetadata,
          model: storedMetadata?.model ?? row.model ?? undefined,
          provider: storedMetadata?.provider ?? row.provider ?? undefined,
        }
      : undefined

  return {
    id: row.id,
    role: row.role as UIMessage['role'],
    parts: (row.parts as UIMessage['parts']) ?? [{ type: 'text', text: row.content ?? '' }],
    ...(metadata ? { metadata } : {}),
  }
}

const extractTextFromParts = (message: UIMessage): string =>
  message.parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .filter(Boolean)
    .join('')

const extractMetadata = (message: UIMessage) => {
  const metadata = message.metadata as ChatMessageMetadata | undefined
  return {
    metadata: metadata ?? null,
    model: metadata?.model ?? null,
    provider: metadata?.provider ?? null,
  }
}

export class ChatMessageModel {
  private readonly db: ChatDatabase
  private readonly userId: string
  private readonly topicModel: ChatTopicModel

  constructor(userId: string, db: ChatDatabase = getServerDB()) {
    this.userId = userId
    this.db = db
    this.topicModel = new ChatTopicModel(userId, db)
  }

  countAll = async () => {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatMessages)
      .where(eq(chatMessages.userId, this.userId))
    return row?.count ?? 0
  }

  listByTopic = async (topicId: string): Promise<UIMessage[]> => {
    const topic = await this.topicModel.findById(topicId)
    if (!topic) return []

    const rows = await this.db.query.chatMessages.findMany({
      where: and(eq(chatMessages.topicId, topicId), eq(chatMessages.userId, this.userId)),
      orderBy: [asc(chatMessages.createdAt)],
    })

    return rows.map(rowToUIMessage)
  }

  replaceAll = async (topicId: string, messages: UIMessage[]): Promise<void> => {
    // Lock the topic row so concurrent PUTs (client abort ≠ server cancel) cannot
    // interleave delete+insert and hit chat_messages_pkey on the same message ids.
    await this.db.transaction(async (tx) => {
      const [topic] = await tx
        .select()
        .from(chatTopics)
        .where(and(eq(chatTopics.id, topicId), eq(chatTopics.userId, this.userId)))
        .for('update')

      if (!topic) {
        throw new Error('Topic not found')
      }

      await tx.delete(chatMessages).where(and(eq(chatMessages.topicId, topicId), eq(chatMessages.userId, this.userId)))

      if (messages.length > 0) {
        const base = Date.now()
        await tx.insert(chatMessages).values(
          messages.map((message, index) => {
            const { metadata, model, provider } = extractMetadata(message)
            const timestamp = new Date(base + index)
            return {
              id: message.id,
              userId: this.userId,
              topicId,
              agentId: topic.agentId,
              role: message.role,
              content: extractTextFromParts(message),
              parts: message.parts,
              metadata,
              model,
              provider,
              createdAt: timestamp,
              updatedAt: timestamp,
            }
          })
        )
      }

      await tx
        .update(chatTopics)
        .set({ updatedAt: new Date() })
        .where(and(eq(chatTopics.id, topicId), eq(chatTopics.userId, this.userId)))
    })
  }
}
