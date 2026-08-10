import { and, asc, desc, eq, gt, inArray, lt, lte, ne, or, sql } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import { channelBindings, channelEventFiles, channelEvents, channelSessions } from '../schemas/channel'
import { files } from '../schemas/file'
import type { ChannelEventItem, ChannelSessionItem } from '../schemas/channel'
import type { ChatDatabase, Transaction } from '../type'

/** 时间线查询用的精简事件（不含 encryptedContextToken）。 */
export type ChannelTimelineEvent = {
  attachments: Array<{
    deliveryError: string | null
    deliveryStatus: string
    direction: string
    fileId: string
    fileName: string
    fileSize: number
    id: string
    summary: string | null
    version: number
  }>
  completedAt: Date | null
  content: string
  createdAt: Date
  durationMs: number | null
  id: string
  lastErrorCode: string | null
  lastErrorMessage: string | null
  messageKind: string
  model: string | null
  provider: string | null
  responseText: string | null
  status: string
}

export const CHANNEL_EVENT_MAX_RETRIES = 8

type IngestEvent = {
  bindingId: string
  content: string
  encryptedContextToken: string
  externalUserId: string
  messageKind: 'command' | 'file' | 'image' | 'text' | 'unsupported'
  platformMessageId: string
}

async function ensureSession(tx: Transaction, event: IngestEvent) {
  const now = new Date()
  const [session] = await tx
    .insert(channelSessions)
    .values({ bindingId: event.bindingId, externalUserId: event.externalUserId, lastActiveAt: now })
    .onConflictDoUpdate({
      set: { lastActiveAt: now, updatedAt: now },
      target: [channelSessions.bindingId, channelSessions.externalUserId],
    })
    .returning()
  return session!
}

export class ChannelEventModel {
  constructor(private readonly db: ChatDatabase = getServerDB()) {}

  /** 入站事件与 poll cursor 必须在同一事务中提交。 */
  ingestAndAdvanceCursor = async (
    event: IngestEvent | null,
    bindingId: string,
    cursor?: string,
    recordHeartbeat = true
  ) => {
    const rows = await this.ingestBatchAndAdvanceCursor(event ? [event] : [], bindingId, cursor, recordHeartbeat)
    return rows[0] ?? null
  }

  /** 一个 getUpdates 批次整体提交，避免 cursor 越过尚未持久化的同批消息。 */
  ingestBatchAndAdvanceCursor = async (
    events: IngestEvent[],
    bindingId: string,
    cursor?: string,
    recordHeartbeat = true
  ) => {
    return this.db.transaction(async (tx) => {
      const inserted: Array<ChannelEventItem & { externalUserName: string | null }> = []
      for (const event of events) {
        const session = await ensureSession(tx, event)
        const [row] = await tx
          .insert(channelEvents)
          .values({
            ...event,
            conversationVersion: session.conversationVersion,
            sessionId: session.id,
          })
          .onConflictDoNothing({ target: [channelEvents.bindingId, channelEvents.platformMessageId] })
          .returning()
        if (row) inserted.push({ ...row, externalUserName: session.externalUserName ?? null })
      }

      const now = new Date()
      await tx
        .update(channelBindings)
        .set({
          ...(cursor !== undefined ? { pollCursor: cursor } : {}),
          ...(recordHeartbeat
            ? {
                lastErrorAt: null,
                lastErrorCode: null,
                lastErrorMessage: null,
                lastHeartbeatAt: now,
                runtimeStatus: 'online',
              }
            : {}),
          ...(events.length ? { lastActiveAt: now } : {}),
          updatedAt: now,
        })
        .where(eq(channelBindings.id, bindingId))
      return inserted
    })
  }

  claimNext = async (owner: string, leaseMs: number): Promise<ChannelEventItem | null> => {
    return this.db.transaction(async (tx) => {
      const now = new Date()
      const [candidate] = await tx
        .select()
        .from(channelEvents)
        .where(
          or(
            and(inArray(channelEvents.status, ['pending', 'retry']), lte(channelEvents.availableAt, now)),
            and(eq(channelEvents.status, 'processing'), lt(channelEvents.leaseExpiresAt, now))
          )
        )
        .orderBy(asc(channelEvents.availableAt), asc(channelEvents.createdAt))
        .limit(1)
        .for('update', { skipLocked: true })
      if (!candidate) return null

      const [claimed] = await tx
        .update(channelEvents)
        .set({
          leaseExpiresAt: new Date(now.getTime() + leaseMs),
          leaseOwner: owner,
          status: 'processing',
          updatedAt: now,
        })
        .where(eq(channelEvents.id, candidate.id))
        .returning()
      return claimed ?? null
    })
  }

  findContext = async (sessionId: string, conversationVersion: number) => {
    const rows = await this.db
      .select({ content: channelEvents.content, responseText: channelEvents.responseText })
      .from(channelEvents)
      .where(
        and(
          eq(channelEvents.sessionId, sessionId),
          eq(channelEvents.conversationVersion, conversationVersion),
          eq(channelEvents.status, 'completed'),
          inArray(channelEvents.messageKind, ['text', 'outbound'])
        )
      )
      .orderBy(desc(channelEvents.completedAt))
      .limit(20)
    return rows.reverse()
  }

  /** 取会话最近一条带加密 context token 的事件（入站优先于 outbound 复制源）。 */
  findLatestEncryptedContextToken = async (sessionId: string): Promise<string | null> => {
    const [row] = await this.db
      .select({ encryptedContextToken: channelEvents.encryptedContextToken })
      .from(channelEvents)
      .where(and(eq(channelEvents.sessionId, sessionId), ne(channelEvents.messageKind, 'outbound')))
      .orderBy(desc(channelEvents.createdAt))
      .limit(1)
    return row?.encryptedContextToken ?? null
  }

  insertOutboundMessage = async (params: {
    bindingId: string
    conversationVersion: number
    encryptedContextToken: string
    externalUserId: string
    platformMessageId?: string
    responseText: string
    sessionId: string
    status?: string
  }) => {
    const now = new Date()
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(channelEvents)
        .values({
          bindingId: params.bindingId,
          completedAt: params.status === 'completed' || !params.status ? now : null,
          content: '',
          conversationVersion: params.conversationVersion,
          encryptedContextToken: params.encryptedContextToken,
          externalUserId: params.externalUserId,
          messageKind: 'outbound',
          platformMessageId: params.platformMessageId ?? `web-outbound:${crypto.randomUUID()}`,
          responseText: params.responseText,
          sessionId: params.sessionId,
          status: params.status ?? 'completed',
        })
        .returning()
      await tx
        .update(channelSessions)
        .set({ lastActiveAt: now, updatedAt: now })
        .where(eq(channelSessions.id, params.sessionId))
      return row!
    })
  }

  findByPlatformMessageId = async (bindingId: string, platformMessageId: string) => {
    return this.db.query.channelEvents.findFirst({
      where: and(eq(channelEvents.bindingId, bindingId), eq(channelEvents.platformMessageId, platformMessageId)),
    })
  }

  resumeOutbound = async (id: string) => {
    const [event] = await this.db
      .update(channelEvents)
      .set({ lastErrorCode: null, lastErrorMessage: null, status: 'processing', updatedAt: new Date() })
      .where(and(eq(channelEvents.id, id), eq(channelEvents.messageKind, 'outbound')))
      .returning()
    return event ?? null
  }

  markOutboundTextSent = async (id: string) => {
    await this.db
      .update(channelEvents)
      .set({ sentChunkCount: 1, updatedAt: new Date() })
      .where(eq(channelEvents.id, id))
  }

  completeOutbound = async (id: string) => {
    const now = new Date()
    await this.db
      .update(channelEvents)
      .set({ completedAt: now, lastErrorCode: null, lastErrorMessage: null, status: 'completed', updatedAt: now })
      .where(and(eq(channelEvents.id, id), eq(channelEvents.messageKind, 'outbound')))
  }

  failOutbound = async (id: string, error: string) => {
    await this.db
      .update(channelEvents)
      .set({ lastErrorCode: 'OUTBOUND_SEND_FAILED', lastErrorMessage: error.slice(0, 500), status: 'failed', updatedAt: new Date() })
      .where(and(eq(channelEvents.id, id), eq(channelEvents.messageKind, 'outbound')))
  }

  saveResponse = async (
    id: string,
    owner: string,
    response: { durationMs?: number; model?: string; provider?: string; text: string }
  ) => {
    const now = new Date()
    const [event] = await this.db
      .update(channelEvents)
      .set({
        durationMs: response.durationMs,
        model: response.model,
        provider: response.provider,
        responseText: response.text,
        updatedAt: now,
      })
      .where(
        and(
          eq(channelEvents.id, id),
          eq(channelEvents.leaseOwner, owner),
          eq(channelEvents.status, 'processing'),
          gt(channelEvents.leaseExpiresAt, now)
        )
      )
      .returning()
    return event ?? null
  }

  /** 发送外部副作用前确认事件仍处于 processing 且持有有效 lease。 */
  hasValidLease = async (id: string, owner: string) => {
    const now = new Date()
    const [row] = await this.db
      .select({ id: channelEvents.id })
      .from(channelEvents)
      .where(
        and(
          eq(channelEvents.id, id),
          eq(channelEvents.leaseOwner, owner),
          eq(channelEvents.status, 'processing'),
          gt(channelEvents.leaseExpiresAt, now)
        )
      )
      .limit(1)
    return Boolean(row)
  }

  markChunkSent = async (id: string, owner: string, sentChunkCount: number) => {
    await this.db
      .update(channelEvents)
      .set({ sentChunkCount, updatedAt: new Date() })
      .where(and(eq(channelEvents.id, id), eq(channelEvents.leaseOwner, owner)))
  }

  complete = async (id: string, owner: string) => {
    const now = new Date()
    await this.db
      .update(channelEvents)
      .set({ completedAt: now, leaseExpiresAt: null, leaseOwner: null, status: 'completed', updatedAt: now })
      .where(and(eq(channelEvents.id, id), eq(channelEvents.leaseOwner, owner)))
  }

  cancel = async (id: string) => {
    await this.db
      .update(channelEvents)
      .set({ leaseExpiresAt: null, leaseOwner: null, status: 'canceled', updatedAt: new Date() })
      .where(eq(channelEvents.id, id))
  }

  retryOrFail = async (event: ChannelEventItem, owner: string, code: string, message: string) => {
    const retryCount = event.retryCount + 1
    const failed = retryCount >= CHANNEL_EVENT_MAX_RETRIES
    const delayMs = Math.min(5 * 60_000, 1000 * 2 ** Math.min(retryCount, 8))
    const now = new Date()
    await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(channelEvents)
        .set({
          availableAt: failed ? event.availableAt : new Date(now.getTime() + delayMs),
          lastErrorCode: code,
          lastErrorMessage: message.slice(0, 500),
          leaseExpiresAt: null,
          leaseOwner: null,
          retryCount,
          status: failed ? 'failed' : 'retry',
          updatedAt: now,
        })
        .where(and(eq(channelEvents.id, event.id), eq(channelEvents.leaseOwner, owner)))
        .returning({ id: channelEvents.id })
      if (!updated) return
      await tx
        .update(channelBindings)
        .set({
          lastErrorAt: now,
          lastErrorCode: code,
          lastErrorMessage: '微信消息处理失败',
          runtimeStatus: 'degraded',
          updatedAt: now,
        })
        .where(eq(channelBindings.id, event.bindingId))
    })
    return failed
  }

  getSession = async (id: string) => {
    return this.db.query.channelSessions.findFirst({ where: eq(channelSessions.id, id) })
  }

  findById = async (id: string) => {
    return this.db.query.channelEvents.findFirst({ where: eq(channelEvents.id, id) })
  }

  /** 按最近活跃时间列出绑定下的渠道会话。 */
  listSessionsByBinding = async (bindingId: string, limit = 50) => {
    return this.db
      .select({
        activeAgentId: channelSessions.activeAgentId,
        conversationVersion: channelSessions.conversationVersion,
        externalUserId: channelSessions.externalUserId,
        externalUserName: channelSessions.externalUserName,
        id: channelSessions.id,
        lastActiveAt: channelSessions.lastActiveAt,
      })
      .from(channelSessions)
      .where(eq(channelSessions.bindingId, bindingId))
      .orderBy(desc(channelSessions.lastActiveAt))
      .limit(Math.min(Math.max(limit, 1), 100))
  }

  /** Dev 监控：列出某平台下全部渠道会话（含所属 binding 元数据）。 */
  listSessionsByPlatform = async (platform: string, limit = 100) => {
    return this.db
      .select({
        activeAgentId: channelSessions.activeAgentId,
        applicationId: channelBindings.applicationId,
        bindingAgentId: channelBindings.agentId,
        bindingId: channelSessions.bindingId,
        bindingUserId: channelBindings.userId,
        conversationVersion: channelSessions.conversationVersion,
        externalUserId: channelSessions.externalUserId,
        externalUserName: channelSessions.externalUserName,
        id: channelSessions.id,
        lastActiveAt: channelSessions.lastActiveAt,
      })
      .from(channelSessions)
      .innerJoin(channelBindings, eq(channelSessions.bindingId, channelBindings.id))
      .where(eq(channelBindings.platform, platform))
      .orderBy(desc(channelSessions.lastActiveAt))
      .limit(Math.min(Math.max(limit, 1), 200))
  }

  /**
   * 按会话拉取当前（或指定）conversationVersion 的事件时间线。
   * 默认取最近 `limit` 条，再按 createdAt 升序返回。
   */
  listTimelineBySession = async (
    sessionId: string,
    options?: {
      after?: { createdAt: Date; id: string }
      conversationVersion?: number
      limit?: number
      watchEventIds?: string[]
    }
  ): Promise<{ events: ChannelTimelineEvent[]; session: ChannelSessionItem } | null> => {
    const session = await this.getSession(sessionId)
    if (!session) return null

    const version = options?.conversationVersion ?? session.conversationVersion
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200)
    const afterCondition = options?.after
      ? or(
          gt(channelEvents.createdAt, options.after.createdAt),
          and(eq(channelEvents.createdAt, options.after.createdAt), gt(channelEvents.id, options.after.id))
        )
      : undefined
    const watchedIds = options?.watchEventIds?.slice(0, 20) ?? []
    const timelineCondition = watchedIds.length
      ? afterCondition
        ? or(afterCondition, inArray(channelEvents.id, watchedIds))
        : inArray(channelEvents.id, watchedIds)
      : afterCondition
    const conditions = [
      eq(channelEvents.sessionId, sessionId),
      eq(channelEvents.conversationVersion, version),
      ...(timelineCondition ? [timelineCondition] : []),
    ]

    const rows = await this.db
      .select({
        completedAt: channelEvents.completedAt,
        content: channelEvents.content,
        createdAt: channelEvents.createdAt,
        durationMs: channelEvents.durationMs,
        id: channelEvents.id,
        lastErrorCode: channelEvents.lastErrorCode,
        lastErrorMessage: channelEvents.lastErrorMessage,
        messageKind: channelEvents.messageKind,
        model: channelEvents.model,
        provider: channelEvents.provider,
        responseText: channelEvents.responseText,
        status: channelEvents.status,
      })
      .from(channelEvents)
      .where(and(...conditions))
      .orderBy(
        options?.after ? asc(channelEvents.createdAt) : desc(channelEvents.createdAt),
        options?.after ? asc(channelEvents.id) : desc(channelEvents.id)
      )
      .limit(limit)

    const orderedRows = options?.after ? rows : rows.reverse()
    const eventIds = orderedRows.map(({ id }) => id)
    const attachmentRows = eventIds.length
      ? await this.db
          .select({
            deliveryError: channelEventFiles.deliveryError,
            deliveryStatus: channelEventFiles.deliveryStatus,
            direction: channelEventFiles.direction,
            eventId: channelEventFiles.eventId,
            fileId: files.id,
            fileName: files.name,
            fileSize: files.size,
            id: channelEventFiles.id,
            summary: channelEventFiles.summary,
            version: channelEventFiles.version,
          })
          .from(channelEventFiles)
          .innerJoin(files, eq(channelEventFiles.fileId, files.id))
          .where(inArray(channelEventFiles.eventId, eventIds))
          .orderBy(asc(channelEventFiles.createdAt))
      : []
    const attachmentsByEvent = new Map<string, typeof attachmentRows>()
    for (const attachment of attachmentRows) {
      const items = attachmentsByEvent.get(attachment.eventId) ?? []
      items.push(attachment)
      attachmentsByEvent.set(attachment.eventId, items)
    }
    const events = orderedRows.map((event) => ({
      ...event,
      attachments: (attachmentsByEvent.get(event.id) ?? []).map(({ eventId: _eventId, ...attachment }) => attachment),
    }))
    return { events, session }
  }

  startNewConversation = async (sessionId: string, activeAgentId?: string | null, excludeEventId?: string) => {
    const now = new Date()
    const [session] = await this.db
      .update(channelSessions)
      .set({
        ...(activeAgentId !== undefined ? { activeAgentId } : {}),
        conversationVersion: sql`${channelSessions.conversationVersion} + 1`,
        lastActiveAt: now,
        updatedAt: now,
      })
      .where(eq(channelSessions.id, sessionId))
      .returning()
    if (session) {
      await this.db
        .update(channelEvents)
        .set({ leaseExpiresAt: null, leaseOwner: null, status: 'canceled', updatedAt: now })
        .where(
          and(
            eq(channelEvents.sessionId, sessionId),
            inArray(channelEvents.status, ['pending', 'retry', 'processing']),
            lt(channelEvents.conversationVersion, session.conversationVersion),
            ...(excludeEventId ? [ne(channelEvents.id, excludeEventId)] : [])
          )
        )
    }
    return session ?? null
  }

  countFailed = async (bindingId: string) => {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(channelEvents)
      .where(and(eq(channelEvents.bindingId, bindingId), eq(channelEvents.status, 'failed')))
    return row?.count ?? 0
  }

  getQueueCounts = async () => {
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int`, status: channelEvents.status })
      .from(channelEvents)
      .where(inArray(channelEvents.status, ['pending', 'processing', 'retry', 'failed']))
      .groupBy(channelEvents.status)
    const counts = { failed: 0, pending: 0, processing: 0, retry: 0 }
    for (const row of rows) {
      if (row.status in counts) counts[row.status as keyof typeof counts] = row.count
    }
    return counts
  }

  requeueFailed = async (bindingId: string, limit = 100) => {
    const rows = await this.db
      .select({ id: channelEvents.id })
      .from(channelEvents)
      .where(and(eq(channelEvents.bindingId, bindingId), eq(channelEvents.status, 'failed')))
      .orderBy(asc(channelEvents.updatedAt))
      .limit(Math.min(limit, 100))
    if (!rows.length) return 0
    const now = new Date()
    await this.db
      .update(channelEvents)
      .set({
        availableAt: now,
        lastErrorCode: null,
        lastErrorMessage: null,
        retryCount: 0,
        status: 'retry',
        updatedAt: now,
      })
      .where(
        inArray(
          channelEvents.id,
          rows.map(({ id }) => id)
        )
      )
    return rows.length
  }

  pruneCompleted = async (olderThan: Date) => {
    await this.db
      .delete(channelEvents)
      .where(and(inArray(channelEvents.status, ['completed', 'canceled']), lt(channelEvents.updatedAt, olderThan)))
  }
}
