import { and, eq } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import { userProviderSettings } from '../schemas/userProviderSettings'
import type { ChatDatabase } from '../type'

export type ProviderEnabledSettings = Record<string, boolean>

export class UserProviderSettingsModel {
  constructor(private readonly db: ChatDatabase = getServerDB()) {}

  async list(userId: string): Promise<ProviderEnabledSettings> {
    const rows = await this.db.query.userProviderSettings.findMany({
      columns: { enabled: true, providerId: true },
      where: eq(userProviderSettings.userId, userId),
    })

    return Object.fromEntries(rows.map(({ enabled, providerId }) => [providerId, enabled]))
  }

  async setEnabled(userId: string, providerId: string, enabled: boolean): Promise<ProviderEnabledSettings> {
    await this.db
      .insert(userProviderSettings)
      .values({
        enabled,
        id: `${userId}:${providerId}`,
        providerId,
        userId,
      })
      .onConflictDoUpdate({
        target: [userProviderSettings.userId, userProviderSettings.providerId],
        set: { enabled, updatedAt: new Date() },
      })

    return this.list(userId)
  }
}
