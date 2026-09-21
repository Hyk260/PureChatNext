import { isAdminRole, USER_ROLE } from '@pure/const'
import type { UserRole } from '@pure/const'
import { createNanoId, generateCompactUuid } from '@pure/utils'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { and, count, desc, eq, ilike, inArray, or } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import { account, passkey, session, twoFactor, users, verification } from '../schemas'
import type { User, UserItem, UserWithoutPassword } from '../schemas'
import { generateAuthUserId } from '../utils/idGenerator'

import type { ChatDatabase } from '../type'

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

export type AdminUserListItem = {
  banned: boolean | null
  banReason: string | null
  createdAt: Date
  email: string | null
  emailVerified: boolean
  fullName: string | null
  id: string
  lastActiveAt: Date
  role: string | null
  userId: string
  username: string | null
}

export type AdminUserPatch = {
  banReason?: string | null
  banned?: boolean
  fullName?: string | null
  role?: UserRole
  username?: string
}

export class AdminUserError extends Error {
  constructor(
    message: string,
    public readonly code: 'conflict' | 'last_admin' | 'self'
  ) {
    super(message)
    this.name = 'AdminUserError'
  }
}

export function isAdminUserError(error: unknown): error is AdminUserError {
  return error instanceof AdminUserError
}

export function assertAdminUserMutationAllowed(input: {
  actorId: string
  activeAdminCount: number
  targetId: string
  targetRole: string | null | undefined
}) {
  if (input.actorId === input.targetId) {
    throw new AdminUserError('不能对自己执行该操作', 'self')
  }

  if (isAdminRole(input.targetRole) && input.activeAdminCount <= 1) {
    throw new AdminUserError('不能移除最后一个管理员', 'last_admin')
  }
}

const adminUserColumns = {
  banned: users.banned,
  banReason: users.banReason,
  createdAt: users.createdAt,
  email: users.email,
  emailVerified: users.emailVerified,
  fullName: users.fullName,
  id: users.id,
  lastActiveAt: users.lastActiveAt,
  role: users.role,
  userId: users.userId,
  username: users.username,
}

export class UserModel {
  private readonly db: ChatDatabase

  constructor(db: ChatDatabase = getServerDB()) {
    this.db = db
  }

  private normalizeUniqueUserFields = <
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

  private excludePassword = (user: UserItem): UserWithoutPassword => {
    const { password: _password, ...userWithoutPassword } = user
    return userWithoutPassword
  }

  private findCredentialAccountPassword = async (authUserId: string) => {
    const [credentialAccount] = await this.db
      .select({ password: account.password })
      .from(account)
      .where(and(eq(account.userId, authUserId), eq(account.providerId, CREDENTIAL_PROVIDER)))
      .limit(1)

    return credentialAccount?.password ?? null
  }

  private toUserWithoutPasswordIfPasswordOk = async (
    user: UserItem | undefined,
    plainPassword: string
  ): Promise<UserWithoutPassword | null> => {
    if (!user) return null

    const storedHash = await this.findCredentialAccountPassword(user.id)
    if (!storedHash || !(await verifyAccountPassword(storedHash, plainPassword))) {
      return null
    }

    return this.excludePassword(user)
  }

  /** 按 Better Auth 主键 id 更新资料字段（全名、兴趣等） */
  updateProfileById = async (id: string, value: { fullName?: string | null; interests?: string[] }) => {
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

  findById = async (id: string) => {
    return this.db.query.users.findFirst({ where: eq(users.id, id) })
  }

  findByUserId = async (userId: string) => {
    return this.db.query.users.findFirst({ where: eq(users.userId, userId) })
  }

  findByUserIdAndPassword = async (userId: string, password: string) => {
    const user = await this.findByUserId(userId)
    return this.toUserWithoutPasswordIfPasswordOk(user, password)
  }

  findByEmail = async (email: string) => {
    return this.db.query.users.findFirst({ where: eq(users.email, email) })
  }

  findByUsername = async (username: string) => {
    return this.db.query.users.findFirst({ where: eq(users.username, username) })
  }

  findSignInCheck = async (lookup: { email: string } | { username: string }) => {
    const user = 'email' in lookup ? await this.findByEmail(lookup.email) : await this.findByUsername(lookup.username)
    if (!user) return null

    const hash = await this.findCredentialAccountPassword(user.id)
    return {
      email: user.email,
      emailVerified: user.emailVerified,
      hasPassword: Boolean(hash && hash.length > 0),
    }
  }

  private getVerificationIdentifiers = (user: UserItem) => {
    return [user.email, user.phone].filter((value): value is string => Boolean(value))
  }

  private countRelatedRecords = async (authId: string, identifiers: string[]): Promise<UserRelatedCounts> => {
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

  private toDeletionPreviewUser = (user: UserItem): UserDeletionPreviewUser => {
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

  getUserDeletionPreview = async (email: string) => {
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

  private deleteUserRecord = async (user: UserItem) => {
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

  deleteUserByEmail = async (email: string) => {
    const user = await this.findByEmail(email.trim())
    if (!user) {
      return { found: false as const }
    }

    return this.deleteUserRecord(user)
  }

  countActiveAdmins = async () => {
    const [row] = await this.db
      .select({ n: count() })
      .from(users)
      .where(and(eq(users.role, USER_ROLE.Admin), eq(users.banned, false)))
    return Number(row?.n ?? 0)
  }

  listUsers = async (query: { page: number; pageSize: number; q?: string }) => {
    const search = query.q?.trim()
    const pattern = search ? `%${search}%` : undefined
    const where = pattern
      ? or(ilike(users.email, pattern), ilike(users.username, pattern), ilike(users.fullName, pattern))
      : undefined

    const [items, [totalRow]] = await Promise.all([
      this.db
        .select(adminUserColumns)
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db.select({ n: count() }).from(users).where(where),
    ])

    return { items, total: Number(totalRow?.n ?? 0) }
  }

  updateByAdmin = async (id: string, actorId: string, patch: AdminUserPatch) => {
    const user = await this.findById(id)
    if (!user) return null

    const isDemote = patch.role === USER_ROLE.User && isAdminRole(user.role)
    const isBan = patch.banned === true && user.banned !== true
    if (isDemote || isBan) {
      assertAdminUserMutationAllowed({
        actorId,
        activeAdminCount: await this.countActiveAdmins(),
        targetId: id,
        targetRole: user.role,
      })
    }

    if (patch.username !== undefined && patch.username !== user.username) {
      const taken = await this.findByUsername(patch.username)
      if (taken && taken.id !== id) {
        throw new AdminUserError('用户名已被占用', 'conflict')
      }
    }

    const values: Partial<User> = { updatedAt: new Date() }
    if (patch.username !== undefined) values.username = patch.username
    if (patch.fullName !== undefined) values.fullName = patch.fullName
    if (patch.role !== undefined) values.role = patch.role
    if (patch.banned !== undefined) {
      values.banned = patch.banned
      if (patch.banned) {
        if (patch.banReason !== undefined) values.banReason = patch.banReason
      } else {
        values.banExpires = null
        values.banReason = null
      }
    } else if (patch.banReason !== undefined) {
      values.banReason = patch.banReason
    }

    const [updated] = await this.db.update(users).set(values).where(eq(users.id, id)).returning(adminUserColumns)
    return updated ?? null
  }

  deleteUserByIdForAdmin = async (id: string, actorId: string) => {
    const user = await this.findById(id)
    if (!user) {
      return { found: false as const }
    }

    assertAdminUserMutationAllowed({
      actorId,
      activeAdminCount: await this.countActiveAdmins(),
      targetId: id,
      targetRole: user.role,
    })

    return this.deleteUserRecord(user)
  }

  findByEmailAndPassword = async (email: string, password: string) => {
    const user = await this.findByEmail(email)
    return this.toUserWithoutPasswordIfPasswordOk(user, password)
  }

  countUsers = async () => {
    const [row] = await this.db.select({ n: count() }).from(users)
    return Number(row?.n ?? 0)
  }

  /** First account becomes admin; everyone after is a regular user. */
  resolveSignupRole = async (): Promise<UserRole> => {
    // ponytail: concurrent first signups can both become admin; fix in DB if it happens
    const total = await this.countUsers()
    return total === 0 ? USER_ROLE.Admin : USER_ROLE.User
  }

  createUser = async (params: Partial<User> & { password?: string | null }) => {
    const { password: plainPassword, ...userFields } = params
    const normalizedParams = this.normalizeUniqueUserFields(userFields)

    if (normalizedParams.userId == null) {
      normalizedParams.userId = generateCompactUuid()
    }

    if (normalizedParams.id == null) {
      // 与 Better Auth advanced.database.generateId 对齐（本路径绕过 BA）
      normalizedParams.id = generateAuthUserId()
    }

    if (normalizedParams.role == null || normalizedParams.role === '') {
      normalizedParams.role = await this.resolveSignupRole()
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

    return { user: this.excludePassword(user) }
  }
}
