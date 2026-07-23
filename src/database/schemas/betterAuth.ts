import { relations } from 'drizzle-orm'
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

import { users } from './user'

// Drizzle 适配器通过 model 名称（单数）查找表定义，需要保留单数别名
export { users as user }

/** Better Auth 登录会话表，存储用户登录后的 session 令牌与元数据 */
export const session = pgTable(
  'auth_sessions',
  {
    // 会话记录创建时间
    createdAt: timestamp('created_at').defaultNow().notNull(),
    // 会话过期时间，过期后需重新登录
    expiresAt: timestamp('expires_at').notNull(),
    // 会话主键 ID
    id: text('id').primaryKey(),
    // 管理员冒充登录时，记录执行冒充操作的管理员用户 ID
    impersonatedBy: text('impersonated_by'),
    // 创建会话时的客户端 IP 地址
    ipAddress: text('ip_address'),
    // 会话令牌，客户端携带此 token 进行身份验证
    token: text('token').notNull().unique(),
    // 会话记录最后更新时间
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    // 创建会话时的浏览器/客户端 User-Agent
    userAgent: text('user_agent'),
    // 关联的用户 ID
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [index('auth_session_userId_idx').on(table.userId)]
)

/** Better Auth 账户关联表，存储 OAuth 第三方账号或邮箱密码登录凭据 */
export const account = pgTable(
  'accounts',
  {
    // OAuth 提供商颁发的访问令牌
    accessToken: text('access_token'),
    // 访问令牌过期时间
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    // 用户在 OAuth 提供商处的账户 ID（如 GitHub user id）
    accountId: text('account_id').notNull(),
    // 账户关联记录创建时间
    createdAt: timestamp('created_at').defaultNow().notNull(),
    // 账户记录主键 ID
    id: text('id').primaryKey(),
    // OpenID Connect ID Token（部分 OAuth 流程使用）
    idToken: text('id_token'),
    // 邮箱密码登录时存储的哈希密码（provider 为 credential 时使用）
    password: text('password'),
    // 认证提供商标识（如 credential、github、google）
    providerId: text('provider_id').notNull(),
    // OAuth 刷新令牌，用于在 access token 过期后获取新令牌
    refreshToken: text('refresh_token'),
    // 刷新令牌过期时间
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    // OAuth 授权范围（如 user:email、read:user）
    scope: text('scope'),
    // 账户记录最后更新时间
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    // 关联的用户 ID
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [index('account_userId_idx').on(table.userId)]
)

/** Better Auth 验证表，存储邮箱验证、Magic Link、OTP 等一次性验证记录 */
export const verification = pgTable(
  'verifications',
  {
    // 验证记录创建时间
    createdAt: timestamp('created_at').defaultNow().notNull(),
    // 验证码/链接过期时间
    expiresAt: timestamp('expires_at').notNull(),
    // 验证记录主键 ID
    id: text('id').primaryKey(),
    // 验证目标标识，通常是邮箱地址或手机号
    identifier: text('identifier').notNull(),
    // 验证记录最后更新时间
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    // 验证码或 Magic Link token 的实际值
    value: text('value').notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
)

/** Better Auth 双因素认证表，存储用户的 TOTP 密钥与备用恢复码 */
export const twoFactor = pgTable(
  'two_factor',
  {
    // 备用恢复码（加密存储），用于丢失认证器时恢复账户
    backupCodes: text('backup_codes').notNull(),
    // 双因素认证记录主键 ID
    id: text('id').primaryKey(),
    // TOTP 密钥，用于生成 6 位动态验证码
    secret: text('secret').notNull(),
    // 关联的用户 ID
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [index('two_factor_secret_idx').on(table.secret), index('two_factor_user_id_idx').on(table.userId)]
)

/** Better Auth Passkey 表，存储 WebAuthn/FIDO2 无密码登录凭据 */
export const passkey = pgTable(
  'passkey',
  {
    // Authenticator Attestation GUID，标识认证器硬件/软件型号
    aaguid: text('aaguid'),
    // 凭据是否已同步备份（如 iCloud Keychain、Google Password Manager）
    backedUp: boolean('backedUp'),
    // 签名计数器，每次认证成功后递增，用于防止重放攻击
    counter: integer('counter'),
    // Passkey 注册时间
    createdAt: timestamp('createdAt').defaultNow(),
    // WebAuthn 凭据唯一 ID，用于识别具体的 Passkey
    credentialID: text('credentialID').notNull(),
    // 设备类型（如 singleDevice 单设备 / multiDevice 多设备同步）
    deviceType: text('deviceType'),
    // Passkey 记录主键 ID
    id: text('id').primaryKey(),
    // 用户为 Passkey 设置的友好名称（如「MacBook Touch ID」）
    name: text('name'),
    // 公钥，用于验证 WebAuthn 认证签名
    publicKey: text('publicKey').notNull(),
    // 支持的传输方式（如 internal、hybrid、usb、nfc）
    transports: text('transports'),
    // 关联的用户 ID
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('passkey_credential_id_unique').on(table.credentialID),
    index('passkey_user_id_idx').on(table.userId),
  ]
)

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(account),
  passkeys: many(passkey),
  sessions: many(session),
  twoFactors: many(twoFactor),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  users: one(users, {
    fields: [session.userId],
    references: [users.id],
  }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  users: one(users, {
    fields: [account.userId],
    references: [users.id],
  }),
}))

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  users: one(users, {
    fields: [twoFactor.userId],
    references: [users.id],
  }),
}))

export const passkeysRelations = relations(passkey, ({ one }) => ({
  users: one(users, {
    fields: [passkey.userId],
    references: [users.id],
  }),
}))
