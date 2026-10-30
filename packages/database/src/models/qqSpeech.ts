import { QQ_SPEECH_LIMITS } from '@pure/const'
import { QQ_MAX_PASSIVE_REPLIES } from '@pure/utils/qqText'
import { and, eq, gt, sql } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import { channelBindings, channelEvents } from '../schemas/channel'
import type { ChatDatabase } from '../type'
import { ChannelEventModel } from './channelEvent'

export type QQSpeechAttempt = {
  requestedAt: string
  senderId: string
  state: 'pending' | 'sent' | 'fallback' | 'skipped' | 'failed' | 'cancelled'
  code?: string
}

export function qqSpeechAdmission(attempts: QQSpeechAttempt[], senderId: string, now: Date): string | undefined {
  const recent = attempts.filter((attempt) => Date.parse(attempt.requestedAt) > now.getTime() - 60_000)
  if (recent.filter((attempt) => attempt.senderId === senderId).length >= QQ_SPEECH_LIMITS.senderPerMinute)
    return 'SENDER_RATE_LIMIT'
  if (recent.length >= QQ_SPEECH_LIMITS.bindingPerMinute) return 'BINDING_RATE_LIMIT'
  const active = recent.filter(
    (attempt) =>
      attempt.state === 'pending' && Date.parse(attempt.requestedAt) > now.getTime() - QQ_SPEECH_LIMITS.durationMs
  )
  if (active.length >= QQ_SPEECH_LIMITS.concurrent) return 'CONCURRENCY_LIMIT'
  return undefined
}

/** Shared PostgreSQL admission; reservations survive webhook retries and multiple app instances. */
export class QQSpeechModel {
  constructor(private readonly db: ChatDatabase = getServerDB()) {}

  async isPending(eventId: string): Promise<boolean> {
    const event = await this.db.query.channelEvents.findFirst({
      columns: { platformPayload: true },
      where: eq(channelEvents.id, eventId),
    })
    return (event?.platformPayload?.speech as QQSpeechAttempt | undefined)?.state === 'pending'
  }

  async cancelPending(bindingId: string, threadId: string) {
    await this.db
      .update(channelEvents)
      .set({
        platformPayload: sql`jsonb_set(${channelEvents.platformPayload}, '{speech,state}', '"cancelled"'::jsonb)`,
      })
      .where(
        and(
          eq(channelEvents.bindingId, bindingId),
          eq(channelEvents.externalUserId, threadId),
          eq(sql<string>`${channelEvents.platformPayload}->'speech'->>'state'`, 'pending')
        )
      )
  }

  async reserve(params: {
    bindingId: string
    eventId: string
    senderId: string
    userId: string
  }): Promise<string | undefined> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`qq-speech:${params.bindingId}`}))`)
      const binding = await tx.query.channelBindings.findFirst({
        where: and(eq(channelBindings.id, params.bindingId), eq(channelBindings.userId, params.userId)),
      })
      if (!binding?.enabled || binding.needsRebind || binding.platform !== 'qq') return 'BINDING_DISABLED'
      const event = await tx.query.channelEvents.findFirst({
        where: and(eq(channelEvents.id, params.eventId), eq(channelEvents.bindingId, params.bindingId)),
      })
      if (!event || event.platformPayload?.speech) return 'DUPLICATE_ATTEMPT'
      const manualCount = await new ChannelEventModel(tx as ChatDatabase).countCompletedOutboundAfter(
        event.sessionId,
        event.conversationVersion,
        event.createdAt
      )
      const usedSeq = Math.max(Number(event.platformPayload?.replySeqUsed) || 0, event.sentChunkCount + manualCount)
      if (usedSeq + 2 > QQ_MAX_PASSIVE_REPLIES) return 'QQ_REPLY_BUDGET'
      const now = new Date()
      const rows = await tx
        .select({ payload: channelEvents.platformPayload })
        .from(channelEvents)
        .where(
          and(
            eq(channelEvents.bindingId, params.bindingId),
            gt(
              sql<string>`${channelEvents.platformPayload}->'speech'->>'requestedAt'`,
              new Date(now.getTime() - 60_000).toISOString()
            )
          )
        )
      const attempts = rows.flatMap(({ payload }) => (payload?.speech ? [payload.speech as QQSpeechAttempt] : []))
      const denied = qqSpeechAdmission(attempts, params.senderId, now)
      if (denied) return denied
      const speech: QQSpeechAttempt = { requestedAt: now.toISOString(), senderId: params.senderId, state: 'pending' }
      await tx
        .update(channelEvents)
        .set({
          platformPayload: sql`coalesce(${channelEvents.platformPayload}, '{}'::jsonb) || ${JSON.stringify({ speech })}::jsonb`,
        })
        .where(eq(channelEvents.id, event.id))
      return undefined
    })
  }

  async finish(eventId: string, state: QQSpeechAttempt['state'], code: string) {
    await this.db
      .update(channelEvents)
      .set({
        platformPayload: sql`jsonb_set(coalesce(${channelEvents.platformPayload}, '{}'::jsonb), '{speech}', coalesce(${channelEvents.platformPayload}->'speech', '{}'::jsonb) || ${JSON.stringify({ state, code })}::jsonb)`,
      })
      .where(eq(channelEvents.id, eventId))
  }

  /** Reserve before network I/O; manual replies and uncertain voice sends share this ledger. */
  async reserveReply(eventId: string, count = 1, fallbackSlots = 0): Promise<number> {
    return this.db.transaction(async (tx) => {
      const [event] = await tx.select().from(channelEvents).where(eq(channelEvents.id, eventId)).for('update')
      if (!event) throw Object.assign(new Error('QQ_PASSIVE_CONTEXT_MISSING'), { code: 'QQ_PASSIVE_CONTEXT_MISSING' })
      const binding = await tx.query.channelBindings.findFirst({ where: eq(channelBindings.id, event.bindingId) })
      if (!binding?.enabled || binding.needsRebind || binding.platform !== 'qq') {
        throw Object.assign(new Error('BINDING_ACCESS_CHANGED'), { code: 'BINDING_ACCESS_CHANGED' })
      }
      const manualCount = await new ChannelEventModel(tx as ChatDatabase).countCompletedOutboundAfter(
        event.sessionId,
        event.conversationVersion,
        event.createdAt
      )
      const recordedSeq = Number(event.platformPayload?.replySeqUsed) || 0
      const used = Math.max(recordedSeq, event.sentChunkCount + manualCount)
      if (count < 1 || used + count + fallbackSlots > QQ_MAX_PASSIVE_REPLIES)
        throw Object.assign(new Error('QQ_REPLY_BUDGET'), { code: 'QQ_REPLY_BUDGET' })
      await tx
        .update(channelEvents)
        .set({
          platformPayload: sql`coalesce(${channelEvents.platformPayload}, '{}'::jsonb) || jsonb_build_object('replySeqUsed', ${used + count}::int)`,
        })
        .where(eq(channelEvents.id, eventId))
      return used + 1
    })
  }
}
