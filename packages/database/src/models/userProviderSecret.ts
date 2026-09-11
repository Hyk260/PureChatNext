import { and, eq } from 'drizzle-orm'
import { decryptVaultJson, encryptVaultJson, providerKeyHint } from '@pure/utils/server'

import { getServerDB } from '../core/db-adaptor'
import { isUserProviderSecretId, USER_PROVIDER_SECRET_IDS, userProviderSecrets } from '../schemas/providerSecret'
import type { UserProviderSecretId } from '../schemas/providerSecret'
import type { ChatDatabase } from '../type'

export { isUserProviderSecretId, USER_PROVIDER_SECRET_IDS }
export type { UserProviderSecretId }

export type ProviderSecretVault = {
  apiKey: string
  baseURL: string
}

export type ProviderSecretPublic = {
  apiKey: string
  baseURL: string
  keyHint: string
  providerId: UserProviderSecretId
}

export class MissingProviderApiKeyError extends Error {
  constructor(message = '请填写 API Key') {
    super(message)
    this.name = 'MissingProviderApiKeyError'
  }
}

const emptyVault = (): ProviderSecretVault => ({ apiKey: '', baseURL: '' })

const parseVault = (payload: string): ProviderSecretVault => {
  const parsed = decryptVaultJson<Partial<ProviderSecretVault>>(payload)
  return {
    apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
    baseURL: typeof parsed.baseURL === 'string' ? parsed.baseURL : '',
  }
}

export class UserProviderSecretModel {
  private readonly db: ChatDatabase

  constructor(db: ChatDatabase = getServerDB()) {
    this.db = db
  }

  /** Owner-facing list: decrypts apiKey for the settings form. Not for other users. */
  listPublic = async (userId: string): Promise<ProviderSecretPublic[]> => {
    const rows = await this.db.query.userProviderSecrets.findMany({
      where: eq(userProviderSecrets.userId, userId),
    })

    const items: ProviderSecretPublic[] = []
    for (const row of rows) {
      if (!isUserProviderSecretId(row.providerId)) continue
      let apiKey = ''
      let baseURL = ''
      try {
        const vault = parseVault(row.keyVaults)
        apiKey = vault.apiKey
        baseURL = vault.baseURL
      } catch {
        apiKey = ''
        baseURL = ''
      }
      items.push({
        apiKey,
        baseURL,
        keyHint: row.keyHint,
        providerId: row.providerId,
      })
    }
    return items
  }

  getDecrypted = async (userId: string, providerId: string): Promise<ProviderSecretVault | null> => {
    if (!isUserProviderSecretId(providerId)) return null
    const row = await this.db.query.userProviderSecrets.findFirst({
      where: and(eq(userProviderSecrets.userId, userId), eq(userProviderSecrets.providerId, providerId)),
    })
    if (!row) return null

    const vault = parseVault(row.keyVaults)
    const apiKey = vault.apiKey.trim()
    if (!apiKey) return null
    return { apiKey, baseURL: vault.baseURL }
  }

  has = async (userId: string, providerId: string): Promise<boolean> => {
    if (!isUserProviderSecretId(providerId)) return false
    const row = await this.db.query.userProviderSecrets.findFirst({
      columns: { id: true },
      where: and(eq(userProviderSecrets.userId, userId), eq(userProviderSecrets.providerId, providerId)),
    })
    return Boolean(row)
  }

  upsert = async (
    userId: string,
    providerId: UserProviderSecretId,
    patch: { apiKey?: string; baseURL?: string }
  ): Promise<ProviderSecretPublic> => {
    const existing = await this.db.query.userProviderSecrets.findFirst({
      where: and(eq(userProviderSecrets.userId, userId), eq(userProviderSecrets.providerId, providerId)),
    })

    let current = emptyVault()
    if (existing) {
      try {
        current = parseVault(existing.keyVaults)
      } catch {
        current = emptyVault()
      }
    }

    const nextApiKey = patch.apiKey?.trim() ? patch.apiKey.trim() : current.apiKey.trim()
    if (!nextApiKey) throw new MissingProviderApiKeyError()
    const nextBaseURL = patch.baseURL !== undefined ? patch.baseURL.trim() : current.baseURL
    const keyVaults = encryptVaultJson({ apiKey: nextApiKey, baseURL: nextBaseURL } satisfies ProviderSecretVault)
    const keyHint = providerKeyHint(nextApiKey)
    const now = new Date()

    if (existing) {
      await this.db
        .update(userProviderSecrets)
        .set({ keyHint, keyVaults, updatedAt: now })
        .where(eq(userProviderSecrets.id, existing.id))
    } else {
      await this.db.insert(userProviderSecrets).values({
        keyHint,
        keyVaults,
        providerId,
        userId,
      })
    }

    return { apiKey: nextApiKey, baseURL: nextBaseURL, keyHint, providerId }
  }

  delete = async (userId: string, providerId: UserProviderSecretId) => {
    await this.db
      .delete(userProviderSecrets)
      .where(and(eq(userProviderSecrets.userId, userId), eq(userProviderSecrets.providerId, providerId)))
  }
}
