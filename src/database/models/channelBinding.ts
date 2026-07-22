import { and, eq } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import {
  channelBindings,
  type ChannelBindingItem,
  type NewChannelBinding,
} from '../schemas/channel'
import { type ChatDatabase } from '../type'

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
      where: and(
        eq(channelBindings.platform, platform),
        eq(channelBindings.applicationId, applicationId),
      ),
    })
  }

  upsert = async (params: {
    agentId: string
    applicationId: string
    credentials: string
    platform: string
    userId: string
  }): Promise<ChannelBindingItem> => {
    const existing = await this.findByUserAndPlatform(params.userId, params.platform)

    const now = new Date()

    if (existing) {
      const [updated] = await this.db
        .update(channelBindings)
        .set({
          agentId: params.agentId,
          applicationId: params.applicationId,
          credentials: params.credentials,
          enabled: true,
          lastActiveAt: now,
          needsRebind: false,
          updatedAt: now,
        })
        .where(eq(channelBindings.id, existing.id))
        .returning()
      return updated
    }

    const [created] = await this.db
      .insert(channelBindings)
      .values({
        agentId: params.agentId,
        applicationId: params.applicationId,
        credentials: params.credentials,
        enabled: true,
        lastActiveAt: now,
        needsRebind: false,
        platform: params.platform,
        userId: params.userId,
      } satisfies NewChannelBinding)
      .returning()
    return created
  }

  /** @deprecated Prefer upsert({ platform: WECHAT_PLATFORM, ... }) */
  upsertWechat = async (params: {
    agentId: string
    applicationId: string
    credentials: string
    userId: string
  }): Promise<ChannelBindingItem> => {
    return this.upsert({ ...params, platform: WECHAT_PLATFORM })
  }

  updateAgent = async (userId: string, platform: string, agentId: string) => {
    const [updated] = await this.db
      .update(channelBindings)
      .set({ agentId, updatedAt: new Date() })
      .where(and(eq(channelBindings.userId, userId), eq(channelBindings.platform, platform)))
      .returning()
    return updated ?? null
  }

  markNeedsRebind = async (id: string) => {
    await this.db
      .update(channelBindings)
      .set({ enabled: false, needsRebind: true, updatedAt: new Date() })
      .where(eq(channelBindings.id, id))
  }

  touchActive = async (id: string) => {
    await this.db
      .update(channelBindings)
      .set({ lastActiveAt: new Date(), updatedAt: new Date() })
      .where(eq(channelBindings.id, id))
  }

  disconnect = async (userId: string, platform: string) => {
    const existing = await this.findByUserAndPlatform(userId, platform)
    if (!existing) return null

    await this.db.delete(channelBindings).where(eq(channelBindings.id, existing.id))
    return existing
  }
}
