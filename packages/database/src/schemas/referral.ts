import { index, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'

import { createdAt, timestamptz } from './_helpers'
import { users } from './user'

export const referrals = pgTable(
  'referrals',
  {
    id: text('id').primaryKey(),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    status: text('status', { enum: ['sending', 'sent', 'failed', 'accepted'] }).notNull(),
    createdAt: createdAt(),
    sentAt: timestamptz('sent_at'),
    expiresAt: timestamptz('expires_at').notNull(),
    acceptedAt: timestamptz('accepted_at'),
    acceptedUserId: text('accepted_user_id').references(() => users.id, { onDelete: 'cascade' }),
    messageId: text('message_id'),
    error: text('error'),
  },
  (table) => [
    index('referrals_inviter_created_idx').on(table.inviterId, table.createdAt, table.id),
    index('referrals_inviter_email_idx').on(table.inviterId, table.email),
    uniqueIndex('referrals_accepted_user_idx').on(table.acceptedUserId),
  ]
)

export type ReferralReservation = { email: string; id?: string; error?: string }

export const referralBatches = pgTable(
  'referral_batches',
  {
    id: text('id').primaryKey(),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    requestKey: text('request_key').notNull(),
    fingerprint: text('fingerprint').notNull(),
    reservations: jsonb('reservations').$type<ReferralReservation[]>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('referral_batches_inviter_key_idx').on(table.inviterId, table.requestKey)]
)

export type Referral = typeof referrals.$inferSelect
