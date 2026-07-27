import { createNanoId, generateCompactUuid } from '@pure/utils'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { and, count, eq, inArray, lt } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import {
  account,
  passkey,
  session,
  twoFactor,
  users,
  verification,
  type User,
  type UserItem,
  type UserWithoutPassword,
} from '../schemas'
import { generateAuthUserId } from '../utils/idGenerator'

import { type ChatDatabase } from '../type'

async function verifyAccountPassword(hash: string, password: string): Promise<boolean> {
  if (!hash) return false
  return verifyPassword({ hash, password })
}

const CREDENTIAL_PROVIDER = 'credential'

export type UserRelatedCounts = {
  accounts: number
  authSessions: number
  passkeys: number
  twoFactor: number
  verifications: number
}

export type UserDeletionPreviewUser = {
  createdAt: Date
  email: string | null
  emailVerified: boolean
  id: string
  role: string | null
  userId: string
  username: string | null
}

export class UserModel {
  private static readonly db: ChatDatabase = getServerDB()

  private static normalizeUniqueUserFields = <
    T extends { email?: string | null; phone?: string | null; userId?: string | null },
  >(
    value: T
  ) => {
    const normalizedEmail = typeof value.email === 'string' && value.email.trim() === '' ? null : value.email
    const normalizedPhone = typeof value.phone === 'string' && value.phone.trim() === '' ? null : value.phone
    const normalizedUserId = value.userId == null || value.userId.trim() === '' ? null : value.userId.trim()

    return {
      ...value,
      ...(value.email !== undefined ? { email: normalizedEmail } : {}),
      ...(value.phone !== undefined ? { phone: normalizedPhone } : {}),
      ...(value.userId !== undefined ? { userId: normalizedUserId } : {}),
    }
  }

  private static excludePassword(user: UserItem): UserWithoutPassword {
    const { password: _password, ...userWithoutPassword } = user
    return userWithoutPassword
  }

  private static findCredentialAccountPassword = async (authUserId: string) => {
    const [credentialAccount] = await this.db
      .select({ password: account.password })
      .from(account)
      .where(and(eq(account.userId, authUserId), eq(account.providerId, CREDENTIAL_PROVIDER)))
      .limit(1)

    return credentialAccount?.password ?? null
  }

  private static async toUserWithoutPasswordIfPasswordOk(
    user: UserItem | undefined,
    plainPassword: string
  ): Promise<UserWithoutPassword | null> {
    if (!user) return null

    const storedHash = await this.findCredentialAccountPassword(user.id)
    if (!storedHash || !(await verifyAccountPassword(storedHash, plainPassword))) {
      return null
    }

    return this.excludePassword(user)
  }

  static updateUser = async (value: Partial<UserItem>) => {
    const { password: _password, ...rest } = value
    const nextValue = UserModel.normalizeUniqueUserFields(rest)
    if (value.userId) {
      return this.db
        .update(users)
        .set({ ...nextValue, updatedAt: new Date() })
        .where(eq(users.userId, value.userId))
    }
  }

  /** 按 Better Auth 主键 id 更新资料字段（全名、兴趣等） */
  static updateProfileById = async (id: string, value: { fullName?: string | null; interests?: string[] }) => {
    return this.db
      .update(users)
      .set({ ...value, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({
        fullName: users.fullName,
        id: users.id,
        interests: users.interests,
      })
  }

  static deleteUser = async (id: string) => {
    return this.db.delete(users).where(eq(users.userId, id))
  }

  static findById = async (id: string) => {
    return this.db.query.users.findFirst({ where: eq(users.id, id) })
  }

  static findByUserId = async (userId: string) => {
    return this.db.query.users.findFirst({ where: eq(users.userId, userId) })
  }

  static findByUserIdAndPassword = async (userId: string, password: string) => {
    const user = await this.findByUserId(userId)
    return this.toUserWithoutPasswordIfPasswordOk(user, password)
  }

  static findByEmail = async (email: string) => {
    return this.db.query.users.findFirst({ where: eq(users.email, email) })
  }

  private static getVerificationIdentifiers = (user: UserItem) => {
    return [user.email, user.phone].filter((value): value is string => Boolean(value))
  }

  private static countRelatedRecords = async (authId: string, identifiers: string[]): Promise<UserRelatedCounts> => {
    const [sessionsResult, accountsResult, twoFactorResult, passkeysResult, verificationsResult] = await Promise.all([
      this.db.select({ count: count() }).from(session).where(eq(session.userId, authId)),
      this.db.select({ count: count() }).from(account).where(eq(account.userId, authId)),
      this.db.select({ count: count() }).from(twoFactor).where(eq(twoFactor.userId, authId)),
      this.db.select({ count: count() }).from(passkey).where(eq(passkey.userId, authId)),
      identifiers.length > 0
        ? this.db.select({ count: count() }).from(verification).where(inArray(verification.identifier, identifiers))
        : Promise.resolve([{ count: 0 }]),
    ])

    return {
      accounts: accountsResult[0]?.count ?? 0,
      authSessions: sessionsResult[0]?.count ?? 0,
      passkeys: passkeysResult[0]?.count ?? 0,
      twoFactor: twoFactorResult[0]?.count ?? 0,
      verifications: verificationsResult[0]?.count ?? 0,
    }
  }

  private static toDeletionPreviewUser = (user: UserItem): UserDeletionPreviewUser => {
    return {
      createdAt: user.createdAt,
      email: user.email,
      emailVerified: user.emailVerified,
      id: user.id,
      role: user.role,
      userId: user.userId,
      username: user.username,
    }
  }

  static getUserDeletionPreview = async (email: string) => {
    const normalizedEmail = email.trim()
    const user = await this.findByEmail(normalizedEmail)

    if (!user) {
      return { found: false as const }
    }

    const identifiers = this.getVerificationIdentifiers(user)
    const relatedCounts = await this.countRelatedRecords(user.id, identifiers)

    return {
      found: true as const,
      relatedCounts,
      user: this.toDeletionPreviewUser(user),
    }
  }

  static deleteUserByEmail = async (email: string) => {
    const normalizedEmail = email.trim()
    const user = await this.findByEmail(normalizedEmail)

    if (!user) {
      return { found: false as const }
    }

    const identifiers = this.getVerificationIdentifiers(user)
    const relatedCounts = await this.countRelatedRecords(user.id, identifiers)

    if (identifiers.length > 0) {
      await this.db.delete(verification).where(inArray(verification.identifier, identifiers))
    }

    await this.db.delete(users).where(eq(users.id, user.id))

    return {
      deleted: {
        relatedCounts,
        user: this.toDeletionPreviewUser(user),
      },
      found: true as const,
    }
  }

  /** 删除创建超过 maxAgeMs 且仍未验证邮箱的用户（释放占坑邮箱） */
  static deleteUnverifiedOlderThan = async (maxAgeMs: number) => {
    const cutoff = new Date(Date.now() - maxAgeMs)
    const staleUsers = await this.db
      .select({
        email: users.email,
        id: users.id,
        phone: users.phone,
      })
      .from(users)
      .where(and(eq(users.emailVerified, false), lt(users.createdAt, cutoff)))

    if (staleUsers.length === 0) {
      return { cutoff, deleted: 0 }
    }

    const identifiers = staleUsers
      .flatMap((user) => [user.email, user.phone])
      .filter((value): value is string => Boolean(value))

    if (identifiers.length > 0) {
      await this.db.delete(verification).where(inArray(verification.identifier, identifiers))
    }

    const ids = staleUsers.map((user) => user.id)
    await this.db.delete(users).where(inArray(users.id, ids))

    return { cutoff, deleted: ids.length }
  }

  static findByEmailAndPassword = async (email: string, password: string) => {
    const user = await this.findByEmail(email)
    return this.toUserWithoutPasswordIfPasswordOk(user, password)
  }

  static createUser = async (params: Partial<User> & { password?: string | null }) => {
    const { password: plainPassword, ...userFields } = params
    const normalizedParams = this.normalizeUniqueUserFields(userFields)

    if (normalizedParams.userId == null) {
      normalizedParams.userId = generateCompactUuid()
    }

    if (normalizedParams.id == null) {
      // 与 Better Auth advanced.database.generateId 对齐（本路径绕过 BA）
      normalizedParams.id = generateAuthUserId()
    }

    const [user] = await this.db
      .insert(users)
      .values(normalizedParams as User)
      .returning()

    if (plainPassword != null && plainPassword.trim() !== '') {
      const email = user.email?.trim().toLowerCase()
      await this.db.insert(account).values({
        accountId: email || user.id,
        createdAt: new Date(),
        id: createNanoId(12)(),
        password: await hashPassword(plainPassword),
        providerId: CREDENTIAL_PROVIDER,
        updatedAt: new Date(),
        userId: user.id,
      })
    }

    return { duplicate: false as const, user: this.excludePassword(user) }
  }
}
