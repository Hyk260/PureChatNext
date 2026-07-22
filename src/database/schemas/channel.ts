import { boolean, index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'

import { idGenerator } from '../utils/idGenerator'
import { timestamptz, timestamps, varchar255 } from './_helpers'
import { users } from './user'

/**
 * 第三方消息渠道绑定（MVP：微信 iLink）。
 * credentials 为加密/服务端-only 文本，勿下发到客户端。
 */
export const channelBindings = pgTable(
  'channel_bindings',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('channels'))
      .primaryKey(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    platform: varchar255('platform').notNull(),
    /** iLink bot id，用于区分连接 */
    applicationId: varchar255('application_id').notNull(),
    /** 加密后的 { botToken, botId, userId } */
    credentials: text('credentials').notNull(),
    agentId: text('agent_id').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    /** 会话过期等，需用户重新扫码 */
    needsRebind: boolean('needs_rebind').notNull().default(false),
    lastActiveAt: timestamptz('last_active_at'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('channel_bindings_user_platform_unique').on(t.userId, t.platform),
    uniqueIndex('channel_bindings_platform_app_unique').on(t.platform, t.applicationId),
    index('channel_bindings_enabled_idx').on(t.enabled, t.platform),
  ],
)

export type ChannelBindingItem = typeof channelBindings.$inferSelect
export type NewChannelBinding = typeof channelBindings.$inferInsert
