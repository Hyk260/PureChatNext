import type { WebProviderConfig, WebProviderId, WebSearchSettings, WebSearchSettingsPatch } from '@pure/types'
import { decryptVaultJson, encryptVaultJson } from '@pure/utils/server'
import { eq } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import { userWebSearchSettings } from '../schemas/webSearchSettings'
import type { ChatDatabase } from '../type'

type Secrets = Partial<Record<WebProviderId, Pick<WebProviderConfig, 'apiKeys' | 'basicAuthPassword'>>>

export function mergeWebSearchSettings(current: WebSearchSettings, patch: WebSearchSettingsPatch): WebSearchSettings {
  const next = { ...current, providers: { ...current.providers } }
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'providers') continue
    if (value === null) delete next[key as keyof WebSearchSettings]
    else Object.assign(next, { [key]: value })
  }
  for (const [id, changes] of Object.entries(patch.providers ?? {})) {
    const provider = id as WebProviderId
    if (changes === null) {
      delete next.providers[provider]
      continue
    }
    const config = { ...next.providers[provider] }
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '' || (Array.isArray(value) && value.length === 0))
        delete config[key as keyof WebProviderConfig]
      else Object.assign(config, { [key]: value })
    }
    next.providers[provider] = config
  }
  return next
}

export class WebSearchSettingsModel {
  constructor(private readonly db: ChatDatabase = getServerDB()) {}

  async get(userId: string): Promise<WebSearchSettings> {
    const row = await this.db.query.userWebSearchSettings.findFirst({ where: eq(userWebSearchSettings.userId, userId) })
    if (!row) return {}
    const settings = { ...row.settings, providers: { ...row.settings.providers } }
    if (row.keyVaults) {
      const secrets = decryptVaultJson<Secrets>(row.keyVaults)
      for (const [id, secret] of Object.entries(secrets)) {
        const provider = id as WebProviderId
        settings.providers[provider] = { ...settings.providers[provider], ...secret }
      }
    }
    return settings
  }

  async patch(userId: string, patch: WebSearchSettingsPatch): Promise<WebSearchSettings> {
    // Lock the owner row so concurrent field saves cannot overwrite each other.
    return this.db.transaction(async (tx) => {
      const { users } = await import('../schemas/user')
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update')
      const next = mergeWebSearchSettings(await new WebSearchSettingsModel(tx as ChatDatabase).get(userId), patch)
      const providers: WebSearchSettings['providers'] = {}
      const secrets: Secrets = {}
      for (const [id, config] of Object.entries(next.providers ?? {})) {
        const { apiKeys, basicAuthPassword, ...publicConfig } = config
        providers[id as WebProviderId] = publicConfig
        if (apiKeys?.length || basicAuthPassword) secrets[id as WebProviderId] = { apiKeys, basicAuthPassword }
      }
      const settings = { ...next, providers }
      const keyVaults = Object.keys(secrets).length ? encryptVaultJson(secrets) : null
      await tx
        .insert(userWebSearchSettings)
        .values({ userId, settings, keyVaults })
        .onConflictDoUpdate({
          target: userWebSearchSettings.userId,
          set: { settings, keyVaults, updatedAt: new Date() },
        })
      return next
    })
  }

  async delete(userId: string) {
    await this.db.delete(userWebSearchSettings).where(eq(userWebSearchSettings.userId, userId))
  }
}
