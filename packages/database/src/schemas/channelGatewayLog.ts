import { index, pgTable, text } from 'drizzle-orm/pg-core'

import type { ChannelLogEvent, ChannelLogPlatform } from '@pure/types'

import { idGenerator } from '../utils/idGenerator'
import { timestamptz, varchar255 } from './_helpers'
import { users } from './user'

export const channelGatewayLogs = pgTable('channel_gateway_logs', {
  id: text('id').$defaultFn(() => idGenerator('channelGatewayLogs')).primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  platform: varchar255('platform').$type<ChannelLogPlatform>().notNull(),
  // Historical context survives a binding being deleted or replaced.
  bindingId: text('binding_id'),
  event: varchar255('event').$type<ChannelLogEvent>().notNull(),
  level: varchar255('level').$type<'info' | 'warn' | 'error'>().notNull(),
  code: varchar255('code'),
  message: text('message').notNull(),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
}, (table) => [
  index('channel_gateway_logs_owner_idx').on(table.userId, table.platform, table.createdAt, table.id),
  index('channel_gateway_logs_expiry_idx').on(table.createdAt),
])

export type ChannelGatewayLogItem = typeof channelGatewayLogs.$inferSelect
