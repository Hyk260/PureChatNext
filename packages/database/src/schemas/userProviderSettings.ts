import { boolean, index, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core'

import { timestamps } from './_helpers'
import { users } from './user'

/** Per-account provider availability. Secrets and model catalogues live elsewhere. */
export const userProviderSettings = pgTable(
  'user_provider_settings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    providerId: varchar('provider_id', { length: 32 }).notNull(),
    enabled: boolean('enabled').notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('user_provider_settings_user_provider_unique').on(table.userId, table.providerId),
    index('user_provider_settings_user_id_idx').on(table.userId),
  ]
)

export type UserProviderSetting = typeof userProviderSettings.$inferSelect
export type NewUserProviderSetting = typeof userProviderSettings.$inferInsert
