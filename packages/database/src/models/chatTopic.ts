import { and, desc, eq, sql } from 'drizzle-orm'
import type { ChatPermissionMode } from '@pure/types'

import { getServerDB } from '../core/db-adaptor'
import { chatTopics } from '../schemas/chat'
import type { ChatDatabase } from '../type'

const DEFAULT_TITLE = '新话题'

export type ChatTopicUpdate = {
  favorite?: boolean
  permissionMode?: ChatPermissionMode
  projectName?: string | null
  title?: string
}

export type TopicDeleteScope = 'all' | 'unfavorited'

export class ChatTopicModel {
  private readonly db: ChatDatabase
  private readonly userId: string

  constructor(userId: string, db: ChatDatabase = getServerDB()) {
    this.userId = userId
    this.db = db
  }

  private ownership = () => eq(chatTopics.userId, this.userId)

  countAll = async () => {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatTopics)
      .where(this.ownership())
    return row?.count ?? 0
  }

  listByAgent = async (agentId: string) => {
    return this.db.query.chatTopics.findMany({
      where: and(this.ownership(), eq(chatTopics.agentId, agentId)),
      orderBy: [desc(chatTopics.updatedAt)],
    })
  }

  create = async ({
    agentId,
    permissionMode,
    projectName,
    title,
  }: {
    agentId: string
    permissionMode?: ChatPermissionMode
    projectName?: string | null
    title?: string
  }) => {
    const [item] = await this.db
      .insert(chatTopics)
      .values({
        agentId,
        permissionMode,
        projectName: projectName?.trim() || null,
        title: title ?? DEFAULT_TITLE,
        userId: this.userId,
      })
      .returning()
    return item!
  }

  updateTitle = async (id: string, title: string) => {
    return this.update(id, { title })
  }

  update = async (id: string, patch: ChatTopicUpdate) => {
    const [item] = await this.db
      .update(chatTopics)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(chatTopics.id, id), this.ownership()))
      .returning()
    return item
  }

  delete = async (id: string) => {
    return this.db.delete(chatTopics).where(and(eq(chatTopics.id, id), this.ownership()))
  }

  deleteByAgent = async (agentId: string, scope: TopicDeleteScope) => {
    const filters = [this.ownership(), eq(chatTopics.agentId, agentId)]
    if (scope === 'unfavorited') filters.push(eq(chatTopics.favorite, false))

    return this.db
      .delete(chatTopics)
      .where(and(...filters))
      .returning({ id: chatTopics.id })
  }

  findById = async (id: string) => {
    return this.db.query.chatTopics.findFirst({
      where: and(eq(chatTopics.id, id), this.ownership()),
    })
  }
}
