import type { ServiceModelSettings } from '@pure/types'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'

import { timestamps } from './_helpers'
import { users } from './user'

export const userServiceModelSettings = pgTable('user_service_model_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  settings: jsonb('settings').$type<ServiceModelSettings>().notNull().default({}),
  ...timestamps,
})
