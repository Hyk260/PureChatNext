import type { ServiceModelSettings, ServiceModelSettingsPatch } from '@pure/types'
import { eq } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import { userServiceModelSettings } from '../schemas/serviceModelSettings'
import type { ChatDatabase } from '../type'

export function mergeServiceModelSettings(
  current: ServiceModelSettings,
  patch: ServiceModelSettingsPatch
): ServiceModelSettings {
  const next = { ...current }
  for (const key of ['topicNaming', 'historyCompression', 'qqSpeech'] as const) {
    if (!(key in patch)) continue
    const value = patch[key]
    if (value == null) delete next[key]
    else next[key] = value
  }
  return next
}

export class ServiceModelSettingsModel {
  constructor(private readonly db: ChatDatabase = getServerDB()) {}

  async get(userId: string): Promise<ServiceModelSettings> {
    const row = await this.db.query.userServiceModelSettings.findFirst({
      where: eq(userServiceModelSettings.userId, userId),
    })
    return row?.settings ?? {}
  }

  async patch(userId: string, patch: ServiceModelSettingsPatch): Promise<ServiceModelSettings> {
    return this.db.transaction(async (tx) => {
      const { users } = await import('../schemas/user')
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update')
      const current = await new ServiceModelSettingsModel(tx as ChatDatabase).get(userId)
      const settings = mergeServiceModelSettings(current, patch)
      await tx
        .insert(userServiceModelSettings)
        .values({ userId, settings })
        .onConflictDoUpdate({
          target: userServiceModelSettings.userId,
          set: { settings, updatedAt: new Date() },
        })
      return settings
    })
  }

  async delete(userId: string) {
    await this.db.delete(userServiceModelSettings).where(eq(userServiceModelSettings.userId, userId))
  }
}
