import { boolean, index, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'

import { idGenerator } from '../utils/idGenerator'
import { timestamptz, timestamps, varchar255 } from './_helpers'
import { users } from './user'

/**
 * 第三方消息渠道绑定（微信 iLink / QQ 开放平台等）。
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
    pollCursor: text('poll_cursor'),
    runtimeStatus: varchar255('runtime_status').notNull().default('stopped'),
    lastHeartbeatAt: timestamptz('last_heartbeat_at'),
    lastErrorCode: varchar255('last_error_code'),
    lastErrorMessage: text('last_error_message'),
    lastErrorAt: timestamptz('last_error_at'),
    pollLeaseOwner: varchar255('poll_lease_owner'),
    pollLeaseExpiresAt: timestamptz('poll_lease_expires_at'),
    lastActiveAt: timestamptz('last_active_at'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('channel_bindings_user_platform_unique').on(t.userId, t.platform),
    uniqueIndex('channel_bindings_platform_app_unique').on(t.platform, t.applicationId),
    index('channel_bindings_enabled_idx').on(t.enabled, t.platform),
    index('channel_bindings_poll_lease_idx').on(t.platform, t.pollLeaseExpiresAt),
  ]
)

/** 每个外部联系人的渠道独立会话，不与网页 Topic 混用。 */
export const channelSessions = pgTable(
  'channel_sessions',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('channelSessions'))
      .primaryKey(),
    bindingId: text('binding_id')
      .references(() => channelBindings.id, { onDelete: 'cascade' })
      .notNull(),
    externalUserId: varchar255('external_user_id').notNull(),
    externalUserName: varchar255('external_user_name'),
    activeAgentId: text('active_agent_id'),
    conversationVersion: integer('conversation_version').notNull().default(1),
    lastActiveAt: timestamptz('last_active_at').notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('channel_sessions_binding_user_unique').on(t.bindingId, t.externalUserId),
    index('channel_sessions_binding_idx').on(t.bindingId),
  ]
)

/** 持久化入站事件，同时作为首版渠道文本历史。 */
export const channelEvents = pgTable(
  'channel_events',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('channelEvents'))
      .primaryKey(),
    bindingId: text('binding_id')
      .references(() => channelBindings.id, { onDelete: 'cascade' })
      .notNull(),
    sessionId: text('session_id')
      .references(() => channelSessions.id, { onDelete: 'cascade' })
      .notNull(),
    platformMessageId: varchar255('platform_message_id').notNull(),
    externalUserId: varchar255('external_user_id').notNull(),
    conversationVersion: integer('conversation_version').notNull(),
    messageKind: varchar255('message_kind').notNull().default('text'),
    content: text('content').notNull(),
    encryptedContextToken: text('encrypted_context_token').notNull(),
    status: varchar255('status').notNull().default('pending'),
    responseText: text('response_text'),
    retryCount: integer('retry_count').notNull().default(0),
    availableAt: timestamptz('available_at').notNull().defaultNow(),
    leaseOwner: varchar255('lease_owner'),
    leaseExpiresAt: timestamptz('lease_expires_at'),
    sentChunkCount: integer('sent_chunk_count').notNull().default(0),
    lastErrorCode: varchar255('last_error_code'),
    lastErrorMessage: text('last_error_message'),
    completedAt: timestamptz('completed_at'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('channel_events_binding_message_unique').on(t.bindingId, t.platformMessageId),
    index('channel_events_queue_idx').on(t.status, t.availableAt, t.leaseExpiresAt),
    index('channel_events_history_idx').on(t.sessionId, t.conversationVersion, t.completedAt),
    index('channel_events_binding_status_idx').on(t.bindingId, t.status),
  ]
)

export type ChannelBindingItem = typeof channelBindings.$inferSelect
export type NewChannelBinding = typeof channelBindings.$inferInsert
export type ChannelSessionItem = typeof channelSessions.$inferSelect
export type NewChannelSession = typeof channelSessions.$inferInsert
export type ChannelEventItem = typeof channelEvents.$inferSelect
export type NewChannelEvent = typeof channelEvents.$inferInsert
