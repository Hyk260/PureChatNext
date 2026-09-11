import { index, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core'

import { idGenerator } from '../utils/idGenerator'
import { timestamps } from './_helpers'
import { users } from './user'

export const USER_PROVIDER_SECRET_IDS = ['openai', 'deepseek'] as const
export type UserProviderSecretId = (typeof USER_PROVIDER_SECRET_IDS)[number]

export const isUserProviderSecretId = (value: string): value is UserProviderSecretId =>
  (USER_PROVIDER_SECRET_IDS as readonly string[]).includes(value)

/**
 * 用户自备服务商密钥（BYOK）。
 * `key_vaults` 为 AES-256-GCM 密文，勿把明文 apiKey 下发到客户端。
 */
export const userProviderSecrets = pgTable(
  'user_provider_secrets',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('providerSecrets'))
      .primaryKey(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    providerId: varchar('provider_id', { length: 32 }).notNull(),
    /** enc:v1: AES-256-GCM JSON `{ apiKey, baseURL }` */
    keyVaults: text('key_vaults').notNull(),
    /** API Key 末 4 位，供设置页展示 */
    keyHint: varchar('key_hint', { length: 16 }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('user_provider_secrets_user_provider_unique').on(table.userId, table.providerId),
    index('user_provider_secrets_user_id_idx').on(table.userId),
  ]
)

export type UserProviderSecretItem = typeof userProviderSecrets.$inferSelect
export type NewUserProviderSecret = typeof userProviderSecrets.$inferInsert
