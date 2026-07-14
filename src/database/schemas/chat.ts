import { index, jsonb, pgTable, text, varchar } from 'drizzle-orm/pg-core'

import { idGenerator } from '../utils/idGenerator'
import { timestamps } from './_helpers'
import { users } from './user'

export const chatTopics = pgTable(
  'chat_topics',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('chatTopics'))
      .primaryKey(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    agentId: text('agent_id').notNull(),
    title: text('title').notNull(),
    ...timestamps,
  },
  (t) => [
    index('chat_topics_user_id_agent_id_idx').on(t.userId, t.agentId),
    index('chat_topics_user_id_updated_at_idx').on(t.userId, t.updatedAt.desc()),
  ],
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
    agentId: text('agent_id').notNull(),
    role: varchar('role', { length: 32 }).notNull(),
    content: text('content'),
    parts: jsonb('parts').$type<unknown[]>(),
    model: text('model'),
    provider: text('provider'),
    ...timestamps,
  },
  (t) => [
    index('chat_messages_topic_id_created_at_idx').on(t.topicId, t.createdAt),
    index('chat_messages_user_id_topic_id_idx').on(t.userId, t.topicId),
  ],
)

export type NewChatMessage = typeof chatMessages.$inferInsert
export type ChatMessageItem = typeof chatMessages.$inferSelect
