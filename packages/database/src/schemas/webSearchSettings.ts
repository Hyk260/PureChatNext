import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import type { WebSearchSettings } from '@pure/types'

import { timestamps } from './_helpers'
import { users } from './user'

export const userWebSearchSettings = pgTable('user_web_search_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  settings: jsonb('settings').$type<WebSearchSettings>().notNull().default({}),
  keyVaults: text('key_vaults'),
  ...timestamps,
})
