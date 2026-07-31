import { MONTHLY_FREE_CREDITS, MIN_RESERVE_CREDITS } from '@pure/const'
import { and, asc, count, desc, eq, gte, ilike, lte, or, sql, sum } from 'drizzle-orm'
import { createNanoId } from '@pure/utils'

import { getServerDB } from '../core/db-adaptor'
import { creditLedger, userCredits } from '../schemas/credits'
import type { UserCreditsItem } from '../schemas/credits'
import type { ChatDatabase } from '../type'

export type CreditsBalance = {
  grant: number
  period: string
  remaining: number
  used: number
}

export type ChargeChatUsageInput = {
  cachedInputTokens?: number
  credits: number
  durationMs: number
  inputTokens?: number
  messageId: string
  model: string
  outputTokens?: number
  period: string
  provider: string
  userId: string
}

export type UsageSortBy = 'createdAt' | 'credits' | 'durationMs' | 'totalTokens'

export type UsageQuery = {
  endAt?: Date
  model?: string
  page: number
  pageSize: number
  sortBy: UsageSortBy
  sortOrder: 'asc' | 'desc'
  startAt?: Date
  userId: string
}

export class FreePlanLimitError extends Error {
  readonly code = 'FreePlanLimit' as const

  constructor(message = 'Free monthly credits exhausted') {
    super(message)
    this.name = 'FreePlanLimitError'
  }
}

const clampRemaining = (grant: number, used: number) => Math.max(0, grant - used)

const newLedgerId = () => createNanoId(21)()

/**
 * 免费积分账本：懒发放 / 懒重置、预检、原子扣减 + messageId 幂等。
 * period 必须由调用方按 Asia/Shanghai 计算后传入。
 */
export class CreditsModel {
  private readonly db: ChatDatabase

  constructor(db: ChatDatabase = getServerDB()) {
    this.db = db
  }

  /** 确保当前 period 行存在；跨月不滚存，新 period 重新发放。 */
  async ensurePeriod(userId: string, period: string, grant = MONTHLY_FREE_CREDITS): Promise<UserCreditsItem> {
    const [existing] = await this.db
      .select()
      .from(userCredits)
      .where(and(eq(userCredits.userId, userId), eq(userCredits.period, period)))
      .limit(1)

    if (existing) return existing

    const [inserted] = await this.db
      .insert(userCredits)
      .values({
        grant,
        period,
        topupBalance: 0,
        used: 0,
        userId,
      })
      .onConflictDoNothing({ target: [userCredits.userId, userCredits.period] })
      .returning()

    if (inserted) {
      await this.db.insert(creditLedger).values({
        credits: grant,
        delta: grant,
        id: newLedgerId(),
        period,
        reason: 'grant',
        userId,
      })
      return inserted
    }

    const [again] = await this.db
      .select()
      .from(userCredits)
      .where(and(eq(userCredits.userId, userId), eq(userCredits.period, period)))
      .limit(1)

    if (!again) throw new Error(`Failed to ensure credits period for user ${userId}`)
    return again
  }

  async getBalance(userId: string, period: string): Promise<CreditsBalance> {
    const row = await this.ensurePeriod(userId, period)
    return {
      grant: row.grant,
      period: row.period,
      remaining: clampRemaining(row.grant, row.used),
      used: row.used,
    }
  }

  /**
   * beforeChat 预检：余额不足或低于 MIN_RESERVE 则抛 FreePlanLimitError。
   * V1 不做金额预扣锁。
   */
  async assertCanChat(userId: string, period: string, minReserve = MIN_RESERVE_CREDITS): Promise<CreditsBalance> {
    const balance = await this.getBalance(userId, period)
    if (balance.remaining <= 0 || balance.remaining < minReserve) {
      throw new FreePlanLimitError('免费积分已用尽。请等待下月重置，或自行配置模型 API Key 继续使用。')
    }
    return balance
  }

  /**
   * onChatFinal：按实际 usage 扣减。同一 messageId 的 chat_usage 只入账一次。
   * 并发打穿时 used 夹逼至 grant，不出现负余额。
   */
  async chargeChatUsage(input: ChargeChatUsageInput): Promise<{ charged: number; skipped: boolean }> {
    const credits = Math.max(0, Math.round(input.credits))
    if (credits <= 0) return { charged: 0, skipped: true }

    return this.db.transaction(async (tx) => {
      const [dup] = await tx
        .select({ id: creditLedger.id })
        .from(creditLedger)
        .where(and(eq(creditLedger.messageId, input.messageId), eq(creditLedger.reason, 'chat_usage')))
        .limit(1)

      if (dup) return { charged: 0, skipped: true }

      await tx
        .insert(userCredits)
        .values({
          grant: MONTHLY_FREE_CREDITS,
          period: input.period,
          topupBalance: 0,
          used: 0,
          userId: input.userId,
        })
        .onConflictDoNothing({ target: [userCredits.userId, userCredits.period] })

      const [before] = await tx
        .select({ grant: userCredits.grant, used: userCredits.used })
        .from(userCredits)
        .where(and(eq(userCredits.userId, input.userId), eq(userCredits.period, input.period)))
        .limit(1)
        .for('update')

      if (!before) throw new Error('Credits row missing after ensure')

      const nextUsed = Math.min(before.grant, before.used + credits)
      const actualCharged = nextUsed - before.used

      await tx
        .update(userCredits)
        .set({
          used: nextUsed,
          updatedAt: new Date(),
        })
        .where(and(eq(userCredits.userId, input.userId), eq(userCredits.period, input.period)))

      await tx.insert(creditLedger).values({
        cachedInputTokens: input.cachedInputTokens,
        credits: actualCharged,
        delta: -actualCharged,
        durationMs: Math.max(0, Math.round(input.durationMs)),
        id: newLedgerId(),
        inputTokens: input.inputTokens,
        messageId: input.messageId,
        model: input.model,
        outputTokens: input.outputTokens,
        period: input.period,
        provider: input.provider,
        reason: 'chat_usage',
        userId: input.userId,
      })

      return { charged: actualCharged, skipped: false }
    })
  }

  async getUsage(query: UsageQuery) {
    const scopeFilters = [eq(creditLedger.userId, query.userId), eq(creditLedger.reason, 'chat_usage')]
    if (query.startAt && query.endAt) {
      scopeFilters.push(gte(creditLedger.createdAt, query.startAt), lte(creditLedger.createdAt, query.endAt))
    }
    const filters = [...scopeFilters]
    if (query.model) {
      filters.push(or(ilike(creditLedger.model, `%${query.model}%`), ilike(creditLedger.provider, `%${query.model}%`))!)
    }
    const where = and(...filters)
    const totalTokens = sql<number>`coalesce(${creditLedger.inputTokens}, 0) + coalesce(${creditLedger.outputTokens}, 0)`
    const sortColumn =
      query.sortBy === 'credits'
        ? creditLedger.credits
        : query.sortBy === 'durationMs'
          ? creditLedger.durationMs
          : query.sortBy === 'totalTokens'
            ? totalTokens
            : creditLedger.createdAt
    const orderBy = query.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)
    const [items, [summary], modelRows] = await Promise.all([
      this.db
        .select({
          cachedInputTokens: creditLedger.cachedInputTokens,
          createdAt: creditLedger.createdAt,
          credits: creditLedger.credits,
          durationMs: creditLedger.durationMs,
          id: creditLedger.id,
          inputTokens: creditLedger.inputTokens,
          model: creditLedger.model,
          outputTokens: creditLedger.outputTokens,
          provider: creditLedger.provider,
          totalTokens,
        })
        .from(creditLedger)
        .where(where)
        .orderBy(orderBy, desc(creditLedger.createdAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ total: count(), totalCredits: sum(creditLedger.credits) })
        .from(creditLedger)
        .where(where),
      this.db
        .selectDistinct({ model: creditLedger.model })
        .from(creditLedger)
        .where(and(...scopeFilters))
        .orderBy(creditLedger.model),
    ])

    return {
      items,
      models: modelRows.flatMap(({ model }) => (model ? [model] : [])),
      page: query.page,
      pageSize: query.pageSize,
      total: summary?.total ?? 0,
      totalCredits: Number(summary?.totalCredits ?? 0),
    }
  }
}
