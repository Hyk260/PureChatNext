import { getServerDB } from '../core/db-adaptor'
import { generateHashedPassword, verifyPassword } from '@/utils'

import { users } from '../schemas'
import { eq } from 'drizzle-orm'

import type { User, UserItem, UserWithoutPassword } from '../schemas'
import type { ChatDatabase } from '../type'

export class UserModel {
  private static readonly db: ChatDatabase = getServerDB()

  private static normalizeUniqueUserFields = <
    T extends { email?: string | null; phone?: string | null; username?: string | null; password?: string | null },
  >(
    value: T
  ) => {
    const normalizedEmail = typeof value.email === 'string' && value.email.trim() === '' ? null : value.email
    const normalizedPhone = typeof value.phone === 'string' && value.phone.trim() === '' ? null : value.phone
    const normalizedPassword = typeof value.password === 'string' && value.password.trim() === '' ? null : value.password
    const normalizedUsername =
      typeof value.username === 'string' && value.username.trim() === '' ? null : value.username?.trim()

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
      ...(value.username !== undefined ? { username: normalizedUsername } : {}),
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
    const nextValue = UserModel.normalizeUniqueUserFields(value);

    return this.db
      .update(users)
      .set({ ...nextValue, updatedAt: new Date() })
      .where(eq(users.userId, users.userId));
  };

  static deleteUser = async (id: string) => {
    return this.db.delete(users).where(eq(users.userId, id))
  };

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

  static findByEmailAndPassword = async (email: string, password: string) => {
    const user = await this.findByEmail(email)
    return this.toUserWithoutPasswordIfPasswordOk(user, password)
  }

  static createUser = async (params: User) => {
    if (params.id) {
      const existing = await this.db.query.users.findFirst({ where: eq(users.id, params.id) })
      if (existing) return { duplicate: true as const }
    }

    const normalizedParams = this.normalizeUniqueUserFields(params)
    const [user] = await this.db.insert(users).values(normalizedParams).returning()

    return { duplicate: false as const, user }
  }
}
