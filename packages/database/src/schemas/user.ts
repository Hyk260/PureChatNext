import { pgTable, index, varchar, text, boolean, jsonb } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { timestamps, timestamptz } from './_helpers'

/** 用户主表，存储账户基本信息及 Better Auth 所需的扩展字段 */
export const users = pgTable(
  'users',
  {
    // 用户主键 ID，Better Auth 会话/账户等表通过此外键关联
    id: text('id').primaryKey().notNull(),
    // 用户名，可用于登录或展示
    username: text('username').unique(),
    // 展示用全名
    fullName: text('full_name'),
    // 兴趣领域（预定义 key 或自定义文本）
    interests: jsonb('interests').$type<string[]>().default([]),
    // 业务侧用户标识（32 位无连字符 UUID），兼容旧版 API 查询
    userId: varchar('user_id', { length: 32 }).notNull().unique(),
    // 用户邮箱，可用于登录，全局唯一
    email: text('email').unique(),
    // 旧版密码哈希（bcrypt），新认证流程密码存于 accounts 表
    password: varchar('password', { length: 64 }),
    // 用户头像 URL
    avatar: text('avatar'),
    // 手机号码，全局唯一
    phone: text('phone').unique(),

    // Better Auth 管理员插件：用户角色（如 user、admin）
    role: text('role'),
    // 是否被封禁，封禁后无法登录
    banned: boolean('banned').default(false),
    // 封禁原因说明
    banReason: text('ban_reason'),
    // 封禁到期时间，为空表示永久封禁
    banExpires: timestamptz('ban_expires'),

    // Better Auth 双因素认证：是否已启用 2FA
    twoFactorEnabled: boolean('two_factor_enabled').default(false),

    // Better Auth 手机号插件：手机号是否已验证
    phoneNumberVerified: boolean('phone_number_verified'),
    // 用户最后活跃时间，用于统计在线状态
    lastActiveAt: timestamptz('last_active_at').notNull().defaultNow(),

    // Better Auth 必需字段：邮箱是否已验证
    emailVerified: boolean('email_verified').default(false).notNull(),
    // 邮箱验证完成时间（兼容旧版 next-auth 字段，可为空）
    emailVerifiedAt: timestamptz('email_verified_at'),

    // 通用时间戳：createdAt 创建时间、updatedAt 更新时间、accessedAt 最后访问时间
    ...timestamps,
  },
  (table) => [
    index('users_email_idx').on(table.email),
    index('users_username_idx').on(table.username),
    index('users_created_at_idx').on(table.createdAt),
    /**
     * 部分索引，用于加速管理员对封禁用户的查询。
     * 仅对 banned=true 的行建立索引。
     */
    index('users_banned_true_created_at_idx')
      .on(table.createdAt)
      .where(sql`${table.banned} = true`),
  ]
)

export type User = typeof users.$inferInsert
export type UserItem = typeof users.$inferSelect

export type UserWithoutPassword = Omit<User, 'password'>
