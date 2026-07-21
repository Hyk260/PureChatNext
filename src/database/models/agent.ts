import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import {
  agents,
  PURE_AI_AGENT_SEED,
  type AgentItem,
  type NewAgent,
} from '../schemas/agent'
import { chatTopics } from '../schemas/chat'
import { type ChatDatabase } from '../type'
import { randomSlug } from '../utils/idGenerator'

export type AgentCreateInput = {
  avatar?: string
  backgroundColor?: string
  description?: string
  marketIdentifier?: string
  model?: string
  params?: Record<string, unknown>
  pinned?: boolean
  provider?: string
  sort?: number
  systemRole?: string
  title: string
}

export type AgentUpdateInput = Partial<
  Pick<
    AgentItem,
    | 'avatar'
    | 'backgroundColor'
    | 'description'
    | 'model'
    | 'params'
    | 'pinned'
    | 'provider'
    | 'sort'
    | 'systemRole'
    | 'title'
  >
> & {
  /** 仅非内置可改 */
  slug?: string
}

export class AgentDeleteError extends Error {
  constructor(
    message: string,
    public readonly code: 'builtin' | 'not_found' | 'has_topics',
  ) {
    super(message)
    this.name = 'AgentDeleteError'
  }
}

export class AgentModel {
  private readonly db: ChatDatabase
  private readonly userId: string

  constructor(userId: string, db: ChatDatabase = getServerDB()) {
    this.userId = userId
    this.db = db
  }

  private visibleWhere = () =>
    or(isNull(agents.userId), eq(agents.userId, this.userId))

  ensureBuiltin = async () => {
    await this.db.insert(agents).values(PURE_AI_AGENT_SEED).onConflictDoNothing({
      target: agents.id,
    })
  }

  listVisible = async () => {
    await this.ensureBuiltin()
    return this.db.query.agents.findMany({
      where: this.visibleWhere(),
      orderBy: [
        desc(agents.isBuiltin),
        desc(agents.pinned),
        asc(agents.sort),
        desc(agents.updatedAt),
      ],
    })
  }

  findVisibleById = async (id: string) => {
    return this.db.query.agents.findFirst({
      where: and(eq(agents.id, id), this.visibleWhere()),
    })
  }

  create = async (params: AgentCreateInput) => {
    // 同一用户从市场重复添加时复用已有行
    if (params.marketIdentifier) {
      const existing = await this.db.query.agents.findFirst({
        where: and(
          eq(agents.userId, this.userId),
          eq(agents.marketIdentifier, params.marketIdentifier),
        ),
      })
      if (existing) return existing
    }

    const values: NewAgent = {
      avatar: params.avatar,
      backgroundColor: params.backgroundColor,
      description: params.description,
      isBuiltin: false,
      marketIdentifier: params.marketIdentifier,
      model: params.model,
      params: params.params ?? {},
      pinned: params.pinned ?? false,
      provider: params.provider,
      slug: randomSlug(2),
      sort: params.sort ?? 0,
      systemRole: params.systemRole,
      title: params.title,
      userId: this.userId,
    }

    const [item] = await this.db.insert(agents).values(values).returning()
    return item!
  }

  update = async (id: string, data: AgentUpdateInput) => {
    const existing = await this.findVisibleById(id)
    if (!existing) return undefined

    const patch: Partial<AgentItem> = {
      updatedAt: new Date(),
    }

    if (data.title !== undefined) patch.title = data.title
    if (data.description !== undefined) patch.description = data.description
    if (data.avatar !== undefined) patch.avatar = data.avatar
    if (data.backgroundColor !== undefined) patch.backgroundColor = data.backgroundColor
    if (data.systemRole !== undefined) patch.systemRole = data.systemRole
    if (data.model !== undefined) patch.model = data.model
    if (data.provider !== undefined) patch.provider = data.provider
    if (data.params !== undefined) patch.params = data.params
    if (data.pinned !== undefined) patch.pinned = data.pinned
    if (data.sort !== undefined) patch.sort = data.sort

    // 内置禁止改 slug；用户助理允许
    if (data.slug !== undefined && !existing.isBuiltin) {
      patch.slug = data.slug
    }

    const [item] = await this.db
      .update(agents)
      .set(patch)
      .where(and(eq(agents.id, id), this.visibleWhere()))
      .returning()
    return item
  }

  countVisible = async () => {
    await this.ensureBuiltin()
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(agents)
      .where(this.visibleWhere())
    return row?.count ?? 0
  }

  countTopics = async (agentId: string) => {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatTopics)
      .where(and(eq(chatTopics.agentId, agentId), eq(chatTopics.userId, this.userId)))
    return row?.count ?? 0
  }

  delete = async (id: string) => {
    const existing = await this.findVisibleById(id)
    if (!existing) {
      throw new AgentDeleteError('Agent not found', 'not_found')
    }
    if (existing.isBuiltin || existing.userId === null) {
      throw new AgentDeleteError('Builtin agent cannot be deleted', 'builtin')
    }
    if (existing.userId !== this.userId) {
      throw new AgentDeleteError('Agent not found', 'not_found')
    }

    const topicCount = await this.countTopics(id)
    if (topicCount > 0) {
      throw new AgentDeleteError('Agent has topics', 'has_topics')
    }

    await this.db
      .delete(agents)
      .where(and(eq(agents.id, id), eq(agents.userId, this.userId)))
  }
}
