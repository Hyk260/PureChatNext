import { and, desc, eq, gt, gte, inArray, lt, sql } from 'drizzle-orm'

import { CHANNEL_LOG_LIMIT, CHANNEL_LOG_RETENTION_MS } from '@pure/types'
import type { ChannelLogInput, ChannelLogPlatform } from '@pure/types'

import { getServerDB } from '../core/db-adaptor'
import { channelGatewayLogs } from '../schemas/channelGatewayLog'
import type { ChatDatabase } from '../type'
import { formatChannelGatewayLogs, normalizeChannelLog } from '../utils/channelGatewayLogs'

export class ChannelGatewayLogModel {
  constructor(private readonly db: ChatDatabase = getServerDB()) {}

  async append(input: ChannelLogInput, now = new Date()) {
    const scope = and(eq(channelGatewayLogs.userId, input.userId), eq(channelGatewayLogs.platform, input.platform))
    const normalized = normalizeChannelLog(input)
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`channel-log:${input.userId}:${input.platform}`}))`)
      await tx.delete(channelGatewayLogs).where(and(scope, lt(channelGatewayLogs.createdAt, new Date(now.getTime() - CHANNEL_LOG_RETENTION_MS))))
      if (normalized.level !== 'info') {
        const recent = await tx.select().from(channelGatewayLogs).where(and(scope,
          gt(channelGatewayLogs.createdAt, new Date(now.getTime() - 60_000)),
        )).orderBy(desc(channelGatewayLogs.createdAt), desc(channelGatewayLogs.id)).limit(CHANNEL_LOG_LIMIT)
        // Recovery/rebinding resets suppression, even if the next error has the same code.
        for (const row of recent) {
          if (row.event === 'online' || row.event === 'recovered' || row.event === 'bound') break
          if (row.event === input.event && row.code === normalized.code && row.bindingId === (input.bindingId ?? null)) return
        }
      }
      await tx.insert(channelGatewayLogs).values({
        ...normalized, bindingId: input.bindingId ?? null, createdAt: now,
        event: input.event, platform: input.platform, userId: input.userId,
      })
      const overflow = tx.select({ id: channelGatewayLogs.id }).from(channelGatewayLogs).where(scope)
        .orderBy(desc(channelGatewayLogs.createdAt), desc(channelGatewayLogs.id)).offset(CHANNEL_LOG_LIMIT)
      await tx.delete(channelGatewayLogs).where(inArray(channelGatewayLogs.id, overflow))
    })
  }

  async read(userId: string, platform: ChannelLogPlatform, now = new Date()) {
    const rows = await this.db.select().from(channelGatewayLogs).where(and(
      eq(channelGatewayLogs.userId, userId), eq(channelGatewayLogs.platform, platform),
      gte(channelGatewayLogs.createdAt, new Date(now.getTime() - CHANNEL_LOG_RETENTION_MS)),
    )).orderBy(desc(channelGatewayLogs.createdAt), desc(channelGatewayLogs.id)).limit(CHANNEL_LOG_LIMIT)
    return formatChannelGatewayLogs(rows)
  }

  async prune(now = new Date()) {
    await this.db.delete(channelGatewayLogs).where(lt(channelGatewayLogs.createdAt, new Date(now.getTime() - CHANNEL_LOG_RETENTION_MS)))
  }
}
