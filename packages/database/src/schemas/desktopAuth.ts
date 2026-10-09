import { index, pgTable, text, varchar } from 'drizzle-orm/pg-core'

import { createdAt, timestamptz, varchar255 } from './_helpers'
import { users } from './user'

export const desktopAuthCodes = pgTable(
  'desktop_auth_codes',
  {
    codeHash: varchar('code_hash', { length: 128 }).primaryKey(),
    clientId: varchar255('client_id').notNull(),
    codeChallenge: varchar('code_challenge', { length: 128 }).notNull(),
    consumedAt: timestamptz('consumed_at'),
    createdAt: createdAt(),
    expiresAt: timestamptz('expires_at').notNull(),
    redirectUri: text('redirect_uri').notNull(),
    state: varchar('state', { length: 256 }).notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [index('desktop_auth_codes_expires_at_idx').on(table.expiresAt)]
)

export type DesktopAuthCode = typeof desktopAuthCodes.$inferSelect
export type NewDesktopAuthCode = typeof desktopAuthCodes.$inferInsert
