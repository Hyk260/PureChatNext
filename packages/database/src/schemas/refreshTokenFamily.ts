import { index, pgTable, text, varchar } from 'drizzle-orm/pg-core'

import { createdAt, timestamptz, updatedAt } from './_helpers'

export const refreshTokenFamilies = pgTable(
  'refresh_token_families',
  {
    createdAt: createdAt(),
    expiresAt: timestamptz('expires_at').notNull(),
    familyId: varchar('family_id', { length: 64 }).primaryKey(),
    revokedAt: timestamptz('revoked_at'),
    tokenId: varchar('token_id', { length: 128 }).notNull(),
    updatedAt: updatedAt(),
    userId: text('user_id').notNull(),
  },
  (table) => [
    index('refresh_token_families_user_id_idx').on(table.userId),
    index('refresh_token_families_expires_at_idx').on(table.expiresAt),
  ]
)

export type RefreshTokenFamily = typeof refreshTokenFamilies.$inferSelect
export type NewRefreshTokenFamily = typeof refreshTokenFamilies.$inferInsert
