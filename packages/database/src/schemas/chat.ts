import { sql } from 'drizzle-orm'
import { boolean, check, index, jsonb, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core'

import type { ChatMessageMetadata, ChatPermissionMode } from '@pure/types'

import { idGenerator } from '../utils/idGenerator'
import { timestamptz, timestamps } from './_helpers'
import { users } from './user'

/**
 * 话题表。`agentId` 约定对应 `agents.id`（不加 FK，便于删助理策略独立演进）。
 */
export const chatTopics = pgTable(
  'chat_topics',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('topics'))
      .primaryKey(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    /** 对应 `agents.id` */
    agentId: text('agent_id').notNull(),
    favorite: boolean('favorite').notNull().default(false),
    permissionMode: text('permission_mode').$type<ChatPermissionMode>().notNull().default('auto'),
    projectName: text('project_name'),
    title: text('title').notNull(),
    ...timestamps,
  },
  (t) => [
    check('chat_topics_permission_mode_check', sql`${t.permissionMode} in ('ask', 'auto', 'full')`),
    index('chat_topics_user_id_agent_id_idx').on(t.userId, t.agentId),
    index('chat_topics_user_id_updated_at_idx').on(t.userId, t.updatedAt.desc()),
  ]
)

export type NewChatTopic = typeof chatTopics.$inferInsert
export type ChatTopicItem = typeof chatTopics.$inferSelect

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    topicId: text('topic_id')
      .references(() => chatTopics.id, { onDelete: 'cascade' })
      .notNull(),
    /** 对应 `agents.id`（冗余便于查询） */
    agentId: text('agent_id').notNull(),
    role: varchar('role', { length: 32 }).notNull(),
    content: text('content'),
    parts: jsonb('parts').$type<unknown[]>(),
    metadata: jsonb('metadata').$type<ChatMessageMetadata>(),
    model: text('model'),
    provider: text('provider'),
    ...timestamps,
  },
  (t) => [
    index('chat_messages_topic_id_created_at_idx').on(t.topicId, t.createdAt),
    index('chat_messages_user_id_topic_id_idx').on(t.userId, t.topicId),
  ]
)

export type NewChatMessage = typeof chatMessages.$inferInsert
export type ChatMessageItem = typeof chatMessages.$inferSelect

export const chatToolApprovals = pgTable(
  'chat_tool_approvals',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('toolApprovals'))
      .primaryKey(),
    topicId: text('topic_id')
      .references(() => chatTopics.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    toolCallId: text('tool_call_id').notNull(),
    identifier: text('identifier').notNull(),
    apiName: text('api_name').notNull(),
    argsHash: text('args_hash').notNull(),
    args: jsonb('args').$type<Record<string, unknown>>().notNull(),
    status: text('status').notNull().default('pending'),
    error: text('error'),
    approvedAt: timestamptz('approved_at'),
    completedAt: timestamptz('completed_at'),
    ...timestamps,
  },
  (t) => [
    check(
      'chat_tool_approvals_status_check',
      sql`${t.status} in ('pending', 'approved', 'denied', 'completed', 'failed')`
    ),
    index('chat_tool_approvals_topic_id_idx').on(t.topicId),
    index('chat_tool_approvals_user_id_idx').on(t.userId),
    // A tool call id is unique within a topic, making retries idempotent.
    uniqueIndex('chat_tool_approvals_topic_tool_call_unique').on(t.topicId, t.toolCallId),
  ]
)

export type NewChatToolApproval = typeof chatToolApprovals.$inferInsert
export type ChatToolApprovalItem = typeof chatToolApprovals.$inferSelect
