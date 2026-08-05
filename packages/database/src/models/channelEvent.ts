import { and, asc, desc, eq, inArray, lt, lte, ne, or, sql } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import { channelBindings, channelEvents, channelSessions } from '../schemas/channel'
import type { ChannelEventItem } from '../schemas/channel'
import type { ChatDatabase, Transaction } from '../type'

export const CHANNEL_EVENT_MAX_RETRIES = 8

type IngestEvent = {
  bindingId: string
  content: string
  encryptedContextToken: string
  externalUserId: string
  messageKind: 'command' | 'text' | 'unsupported'
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
      const inserted: ChannelEventItem[] = []
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
        if (row) inserted.push(row)
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
          eq(channelEvents.messageKind, 'text')
        )
      )
      .orderBy(desc(channelEvents.completedAt))
      .limit(20)
    return rows.reverse()
  }

  saveResponse = async (id: string, owner: string, responseText: string) => {
    const [event] = await this.db
      .update(channelEvents)
      .set({ responseText, updatedAt: new Date() })
      .where(and(eq(channelEvents.id, id), eq(channelEvents.leaseOwner, owner)))
      .returning()
    return event ?? null
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
      await tx
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
      .set({ availableAt: now, lastErrorCode: null, lastErrorMessage: null, retryCount: 0, status: 'retry', updatedAt: now })
      .where(inArray(channelEvents.id, rows.map(({ id }) => id)))
    return rows.length
  }

  pruneCompleted = async (olderThan: Date) => {
    await this.db
      .delete(channelEvents)
      .where(and(inArray(channelEvents.status, ['completed', 'canceled']), lt(channelEvents.updatedAt, olderThan)))
  }
}
