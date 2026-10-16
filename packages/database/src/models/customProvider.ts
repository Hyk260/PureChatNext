import { and, eq, inArray, sql } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import { agents } from '../schemas/agent'
import { channelBindings, channelEvents } from '../schemas/channel'
import { chatMessages } from '../schemas/chat'
import { customProviders } from '../schemas/customProvider'
import { userProviderSecrets } from '../schemas/providerSecret'
import type { CustomProviderItem, NewCustomProvider } from '../schemas/customProvider'
import type { ChatDatabase } from '../type'

export const BUILTIN_PROVIDER_IDS = new Set(['purechat', 'openai', 'deepseek'])

export const isValidProviderId = (id: string) =>
  /^[a-z0-9][a-z0-9_-]{0,31}$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id)

export type CustomProviderPatch = Partial<Pick<CustomProviderItem, 'baseURL' | 'description' | 'enabled' | 'logo' | 'name'>>

export class CustomProviderModel {
  private readonly db: ChatDatabase
  private readonly userId: string

  constructor(userId: string, db: ChatDatabase = getServerDB()) {
    this.userId = userId
    this.db = db
  }

  list = async () =>
    this.db.query.customProviders.findMany({
      where: eq(customProviders.userId, this.userId),
      orderBy: [customProviders.createdAt],
    })

  find = async (providerId: string) =>
    this.db.query.customProviders.findFirst({
      where: and(eq(customProviders.userId, this.userId), eq(customProviders.providerId, providerId)),
    })

  create = async (provider: Omit<NewCustomProvider, 'id' | 'userId'>) => {
    const [created] = await this.db
      .insert(customProviders)
      .values({ ...provider, userId: this.userId })
      .returning()
    return created!
  }

  update = async (providerId: string, patch: CustomProviderPatch) => {
    const [updated] = await this.db
      .update(customProviders)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(customProviders.userId, this.userId), eq(customProviders.providerId, providerId)))
      .returning()
    return updated ?? null
  }

  delete = async (providerId: string) => {
    await this.db.transaction(async (tx) => {
      const ownerScope = and(eq(customProviders.userId, this.userId), eq(customProviders.providerId, providerId))
      const [provider] = await tx.select().from(customProviders).where(ownerScope).limit(1).for('update')
      if (!provider) return

      const bindings = await tx
        .select({ id: channelBindings.id })
        .from(channelBindings)
        .where(and(eq(channelBindings.userId, this.userId), eq(channelBindings.provider, providerId)))
      const bindingIds = bindings.map((binding) => binding.id)

      await tx
        .update(chatMessages)
        .set({
          metadata: sql`${chatMessages.metadata} - 'provider' - 'model'`,
          model: null,
          provider: null,
        })
        .where(and(eq(chatMessages.userId, this.userId), eq(chatMessages.provider, providerId)))

      await tx
        .update(agents)
        .set({ model: null, provider: null, updatedAt: new Date() })
        .where(and(eq(agents.userId, this.userId), eq(agents.provider, providerId)))

      await tx
        .update(channelBindings)
        .set({ model: null, provider: null, updatedAt: new Date() })
        .where(and(eq(channelBindings.userId, this.userId), eq(channelBindings.provider, providerId)))

      if (bindingIds.length > 0) {
        await tx
          .update(channelEvents)
          .set({ model: null, provider: null, updatedAt: new Date() })
          .where(inArray(channelEvents.bindingId, bindingIds))
      }

      await tx
        .delete(userProviderSecrets)
        .where(and(eq(userProviderSecrets.userId, this.userId), eq(userProviderSecrets.providerId, providerId)))

      await tx.delete(customProviders).where(ownerScope)
    })
  }
}
