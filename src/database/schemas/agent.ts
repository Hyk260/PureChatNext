import { isNotNull, isNull } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

import { idGenerator, randomSlug } from '../utils/idGenerator'
import { timestamps, varchar255 } from './_helpers'
import { users } from './user'

/**
 * 助手配置表
 */
export const agents = pgTable(
  'agents',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('agents'))
      .primaryKey(),
    slug: varchar('slug', { length: 100 })
      .$defaultFn(() => randomSlug(2))
      .notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    title: varchar255('title').notNull(),
    description: varchar('description', { length: 1000 }),
    avatar: text('avatar'),
    backgroundColor: text('background_color'),
    systemRole: text('system_role'),
    model: text('model'),
    provider: text('provider'),
    params: jsonb('params').$type<Record<string, unknown>>().default({}),
    pinned: boolean('pinned').default(false),
    isBuiltin: boolean('is_builtin').notNull().default(false),
    sort: integer('sort').notNull().default(0),
    marketIdentifier: text('market_identifier'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('agents_slug_builtin_unique')
      .on(t.slug)
      .where(isNull(t.userId)),
    uniqueIndex('agents_slug_user_id_unique')
      .on(t.userId, t.slug)
      .where(isNotNull(t.userId)),
    index('agents_user_id_idx').on(t.userId),
    index('agents_is_builtin_idx').on(t.isBuiltin),
    index('agents_list_order_idx').on(t.isBuiltin.desc(), t.pinned.desc(), t.sort, t.updatedAt.desc()),
  ],
)

export type NewAgent = typeof agents.$inferInsert
export type AgentItem = typeof agents.$inferSelect

/** Pure AI 固定 id，与 seed / 常量一致 */
export const PURE_AI_AGENT_ID = 'agt_inbox'

export const PURE_AI_AGENT_SEED: NewAgent = {
  avatar: '✨',
  description: '你的默认 AI 助手',
  id: PURE_AI_AGENT_ID,
  isBuiltin: true,
  pinned: true,
  slug: 'inbox',
  sort: 0,
  systemRole: [
    '你是 Pure AI，一位友好、清晰、务实的助手。',
    '回答保持结构清楚、可执行；不确定时主动说明假设。',
  ].join('\n'),
  title: 'Pure AI',
  userId: null,
}
