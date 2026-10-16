import { boolean, index, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core'

import { idGenerator } from '../utils/idGenerator'
import { timestamps } from './_helpers'
import { users } from './user'

/** User-owned OpenAI-compatible provider definitions. API keys remain in the encrypted secret vault. */
export const customProviders = pgTable(
  'custom_providers',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('customProviders'))
      .primaryKey(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    providerId: varchar('provider_id', { length: 32 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    description: varchar('description', { length: 1000 }).notNull().default(''),
    logo: text('logo'),
    baseURL: text('base_url').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('custom_providers_user_provider_unique').on(table.userId, table.providerId),
    index('custom_providers_user_id_idx').on(table.userId),
  ]
)

export type CustomProviderItem = typeof customProviders.$inferSelect
export type NewCustomProvider = typeof customProviders.$inferInsert
