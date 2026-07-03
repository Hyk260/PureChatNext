import { getServerDB } from '../core/db-adaptor'
import { generateHashedPassword, verifyPassword } from '@/utils'

import { account, passkey, session, twoFactor, users, verification } from '../schemas'
import { count, eq, inArray } from 'drizzle-orm'

import type { User, UserItem, UserWithoutPassword } from '../schemas'
import type { ChatDatabase } from '../type'

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
    T extends { email?: string | null; phone?: string | null; userId?: string | null; password?: string | null },
  >(
    value: T
  ) => {
    const normalizedEmail = typeof value.email === 'string' && value.email.trim() === '' ? null : value.email
    const normalizedPhone = typeof value.phone === 'string' && value.phone.trim() === '' ? null : value.phone
    const normalizedUserId = value.userId == null || value.userId.trim() === '' ? null : value.userId.trim()
    const normalizedPassword =
      typeof value.password === 'string' && value.password.trim() === '' ? null : value.password

    const passwordOut =
      value.password === undefined
        ? {}
        : {
            password:
              normalizedPassword != null && normalizedPassword !== ''
                ? generateHashedPassword(normalizedPassword)
                : null,
          }

    return {
      ...value,
      ...(value.email !== undefined ? { email: normalizedEmail } : {}),
      ...(value.phone !== undefined ? { phone: normalizedPhone } : {}),
      ...(value.userId !== undefined ? { userId: normalizedUserId } : {}),
      ...passwordOut,
    }
  }

  private static excludePassword(user: UserItem): UserWithoutPassword {
    const { password: _password, ...userWithoutPassword } = user
    return userWithoutPassword
  }

  private static toUserWithoutPasswordIfPasswordOk(
    user: UserItem | undefined,
    plainPassword: string
  ): UserWithoutPassword | null {
    if (!user?.password || !verifyPassword(plainPassword, user.password)) {
      return null
    }
    return this.excludePassword(user)
  }

  static updateUser = async (value: Partial<UserItem>) => {
    const nextValue = UserModel.normalizeUniqueUserFields(value)
    if (value.userId) {
      return this.db
        .update(users)
        .set({ ...nextValue, updatedAt: new Date() })
        .where(eq(users.userId, value.userId))
    }
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

  static findByEmailAndPassword = async (email: string, password: string) => {
    const user = await this.findByEmail(email)
    return this.toUserWithoutPasswordIfPasswordOk(user, password)
  }

  static createUser = async (params: Partial<User>) => {
    const normalizedParams = this.normalizeUniqueUserFields(params)

    if (normalizedParams.userId == null) {
      normalizedParams.userId = crypto.randomUUID().replace(/-/g, '')
    }

    const [user] = await this.db
      .insert(users)
      .values(normalizedParams as User)
      .returning()

    return { duplicate: false as const, user }
  }
}
