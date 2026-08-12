import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import { channelBindings, channelEvents, channelSessions } from '../schemas/channel'
import type { ChannelBindingItem, NewChannelBinding } from '../schemas/channel'
import type { ChatDatabase } from '../type'

export const WECHAT_PLATFORM = 'wechat' as const
export const QQ_PLATFORM = 'qq' as const

export class ChannelBindingModel {
  private readonly db: ChatDatabase

  constructor(db: ChatDatabase = getServerDB()) {
    this.db = db
  }

  findByUserAndPlatform = async (userId: string, platform: string) => {
    return this.db.query.channelBindings.findFirst({
      where: and(eq(channelBindings.userId, userId), eq(channelBindings.platform, platform)),
    })
  }

  findEnabledByPlatform = async (platform: string) => {
    return this.db.query.channelBindings.findMany({
      where: and(eq(channelBindings.platform, platform), eq(channelBindings.enabled, true)),
    })
  }

  findByApplicationId = async (platform: string, applicationId: string) => {
    return this.db.query.channelBindings.findFirst({
      where: and(eq(channelBindings.platform, platform), eq(channelBindings.applicationId, applicationId)),
    })
  }

  findById = async (id: string) => {
    return this.db.query.channelBindings.findFirst({
      where: eq(channelBindings.id, id),
    })
  }

  upsert = async (params: {
    agentId: string
    applicationId: string
    credentials: string
    platform: string
    provider?: string | null
    model?: string | null
    userId: string
  }): Promise<ChannelBindingItem> => {
    const existing = await this.findByUserAndPlatform(params.userId, params.platform)

    const now = new Date()

    if (existing) {
      return this.db.transaction(async (tx) => {
        await tx.delete(channelSessions).where(eq(channelSessions.bindingId, existing.id))
        const [updated] = await tx
          .update(channelBindings)
          .set({
            agentId: params.agentId,
            applicationId: params.applicationId,
            credentials: params.credentials,
            enabled: true,
            model: params.model,
            lastActiveAt: now,
            lastErrorAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            lastHeartbeatAt: null,
            needsRebind: false,
            pendingWelcome: true,
            pollCursor: null,
            gatewayLeaseExpiresAt: null,
            gatewayLeaseOwner: null,
            provider: params.provider,
            runtimeStatus: 'starting',
            updatedAt: now,
          })
          .where(eq(channelBindings.id, existing.id))
          .returning()
        return updated
      })
    }

    const [created] = await this.db
      .insert(channelBindings)
      .values({
        agentId: params.agentId,
        applicationId: params.applicationId,
        credentials: params.credentials,
        enabled: true,
        model: params.model,
        lastActiveAt: now,
        needsRebind: false,
        pendingWelcome: true,
        platform: params.platform,
        provider: params.provider,
        runtimeStatus: 'starting',
        userId: params.userId,
      } satisfies NewChannelBinding)
      .returning()
    return created
  }

  /** 欢迎语发送成功后清除标记，避免重复推送。 */
  clearPendingWelcome = async (id: string) => {
    const [updated] = await this.db
      .update(channelBindings)
      .set({ pendingWelcome: false, updatedAt: new Date() })
      .where(and(eq(channelBindings.id, id), eq(channelBindings.pendingWelcome, true)))
      .returning()
    return updated ?? null
  }

  updateAgent = async (userId: string, platform: string, agentId: string) => {
    const [updated] = await this.db
      .update(channelBindings)
      .set({ agentId, updatedAt: new Date() })
      .where(and(eq(channelBindings.userId, userId), eq(channelBindings.platform, platform)))
      .returning()
    return updated ?? null
  }

  /** 原子更新完整渠道配置，并让所有既有会话进入全新上下文。 */
  updateConfiguration = async (params: {
    agentId: string
    model: string
    platform: string
    provider: string
    userId: string
  }) => {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(channelBindings)
        .where(and(eq(channelBindings.userId, params.userId), eq(channelBindings.platform, params.platform)))
        .limit(1)
        .for('update')
      if (!existing) return null
      const now = new Date()
      const [updated] = await tx
        .update(channelBindings)
        .set({ agentId: params.agentId, model: params.model, provider: params.provider, updatedAt: now })
        .where(eq(channelBindings.id, existing.id))
        .returning()
      await tx
        .update(channelSessions)
        .set({
          activeAgentId: null,
          conversationVersion: sql`${channelSessions.conversationVersion} + 1`,
          updatedAt: now,
        })
        .where(eq(channelSessions.bindingId, existing.id))
      await tx
        .update(channelEvents)
        .set({ leaseExpiresAt: null, leaseOwner: null, status: 'canceled', updatedAt: now })
        .where(
          and(
            eq(channelEvents.bindingId, existing.id),
            inArray(channelEvents.status, ['pending', 'retry', 'processing'])
          )
        )
      return updated ?? null
    })
  }

  markNeedsRebind = async (id: string) => {
    await this.db
      .update(channelBindings)
      .set({
        enabled: false,
        needsRebind: true,
        gatewayLeaseExpiresAt: null,
        gatewayLeaseOwner: null,
        runtimeStatus: 'needs_rebind',
        updatedAt: new Date(),
      })
      .where(eq(channelBindings.id, id))
  }

  touchActive = async (id: string) => {
    await this.db
      .update(channelBindings)
      .set({ lastActiveAt: new Date(), updatedAt: new Date() })
      .where(eq(channelBindings.id, id))
  }

  acquireGatewayLease = async (id: string, owner: string, leaseMs: number) => {
    const now = new Date()
    const [binding] = await this.db
      .update(channelBindings)
      .set({
        gatewayLeaseExpiresAt: new Date(now.getTime() + leaseMs),
        gatewayLeaseOwner: owner,
        updatedAt: now,
      })
      .where(
        and(
          eq(channelBindings.id, id),
          eq(channelBindings.enabled, true),
          or(
            isNull(channelBindings.gatewayLeaseExpiresAt),
            lt(channelBindings.gatewayLeaseExpiresAt, now),
            eq(channelBindings.gatewayLeaseOwner, owner)
          )
        )
      )
      .returning()
    return binding ?? null
  }

  renewGatewayLease = async (id: string, owner: string, leaseMs: number) => {
    const now = new Date()
    const [binding] = await this.db
      .update(channelBindings)
      .set({ gatewayLeaseExpiresAt: new Date(now.getTime() + leaseMs), updatedAt: now })
      .where(
        and(eq(channelBindings.id, id), eq(channelBindings.gatewayLeaseOwner, owner), eq(channelBindings.enabled, true))
      )
      .returning()
    return binding ?? null
  }

  releaseGatewayLease = async (id: string, owner: string) => {
    await this.db
      .update(channelBindings)
      .set({ gatewayLeaseExpiresAt: null, gatewayLeaseOwner: null, updatedAt: new Date() })
      .where(and(eq(channelBindings.id, id), eq(channelBindings.gatewayLeaseOwner, owner)))
  }

  updateGatewayStatus = async (
    id: string,
    status: 'starting' | 'online' | 'degraded' | 'offline' | 'needs_rebind',
    error?: { code: string; message: string } | null
  ) => {
    const now = new Date()
    await this.db
      .update(channelBindings)
      .set({
        lastErrorAt: error ? now : null,
        lastErrorCode: error?.code.slice(0, 100) ?? null,
        lastErrorMessage: error?.message.slice(0, 500) ?? null,
        lastHeartbeatAt: status === 'online' ? now : undefined,
        runtimeStatus: status,
        updatedAt: now,
      })
      .where(eq(channelBindings.id, id))
  }

  touchGatewayHeartbeat = async (id: string) => {
    const now = new Date()
    await this.db
      .update(channelBindings)
      .set({
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastHeartbeatAt: now,
        runtimeStatus: 'online',
        updatedAt: now,
      })
      .where(and(eq(channelBindings.id, id), eq(channelBindings.enabled, true)))
  }

  updateCredentials = async (id: string, credentials: string) => {
    await this.db
      .update(channelBindings)
      .set({ credentials, updatedAt: new Date() })
      .where(eq(channelBindings.id, id))
  }

  disconnect = async (userId: string, platform: string) => {
    const existing = await this.findByUserAndPlatform(userId, platform)
    if (!existing) return null

    await this.db.delete(channelBindings).where(eq(channelBindings.id, existing.id))
    return existing
  }
}
