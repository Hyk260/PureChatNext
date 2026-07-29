import { sql } from 'drizzle-orm'
import { integer, pgTable, text, uniqueIndex, index, varchar } from 'drizzle-orm/pg-core'

import { createdAt, timestamptz } from './_helpers'
import { users } from './user'

/** 用户按自然月（Asia/Shanghai `YYYY-MM`）的免费积分余额。 */
export const userCredits = pgTable(
  'user_credits',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 计费周期，如 `2026-07`（上海时区） */
    period: varchar('period', { length: 7 }).notNull(),
    /** 本周期发放额；V1 恒为 500_000 */
    grant: integer('grant').notNull(),
    /** 本周期已用积分 */
    used: integer('used').notNull().default(0),
    /** 预留下一版充值余额；V1 恒 0 */
    topupBalance: integer('topup_balance').notNull().default(0),
    updatedAt: timestamptz('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('user_credits_user_period_unique').on(table.userId, table.period),
    index('user_credits_period_idx').on(table.period),
  ]
)

export type CreditLedgerReason = 'grant' | 'reset' | 'chat_usage' | 'adjust'

/** 积分流水；同一 `message_id` + `reason=chat_usage` 只入账一次。 */
export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    period: varchar('period', { length: 7 }).notNull(),
    /** 负数为扣减，正数为发放 */
    delta: integer('delta').notNull(),
    reason: varchar('reason', { length: 32 }).$type<CreditLedgerReason>().notNull(),
    provider: text('provider'),
    model: text('model'),
    messageId: text('message_id'),
    /** 模型返回的输入 Token；历史流水为空。 */
    inputTokens: integer('input_tokens'),
    /** 模型返回的输出 Token；历史流水为空。 */
    outputTokens: integer('output_tokens'),
    /** 命中缓存的输入 Token；历史流水为空。 */
    cachedInputTokens: integer('cached_input_tokens'),
    /** 从开始调用模型到流式生成结束的耗时（毫秒）。 */
    durationMs: integer('duration_ms'),
    /** 绝对值，便于展示 */
    credits: integer('credits').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('credit_ledger_user_period_idx').on(table.userId, table.period),
    index('credit_ledger_user_created_at_idx').on(table.userId, table.createdAt),
    uniqueIndex('credit_ledger_chat_usage_message_unique')
      .on(table.messageId)
      .where(sql`${table.reason} = 'chat_usage' AND ${table.messageId} IS NOT NULL`),
  ]
)

export type UserCreditsItem = typeof userCredits.$inferSelect
export type NewUserCredits = typeof userCredits.$inferInsert
export type CreditLedgerItem = typeof creditLedger.$inferSelect
export type NewCreditLedger = typeof creditLedger.$inferInsert
