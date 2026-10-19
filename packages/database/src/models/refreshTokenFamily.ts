import { and, eq, gt, isNull, lt, ne } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import { refreshTokenFamilies } from '../schemas'
import type { ChatDatabase } from '../type'

export class RefreshTokenFamilyModel {
  constructor(private readonly db: ChatDatabase = getServerDB()) {}

  create = async (input: typeof refreshTokenFamilies.$inferInsert) => {
    await this.deleteExpired()
    const [created] = await this.db.insert(refreshTokenFamilies).values(input).returning()
    return created
  }

  rotate = async (input: {
    expiresAt: Date
    familyId: string
    nextTokenId: string
    previousTokenId: string
    userId: string
  }) => {
    const now = new Date()
    const updateActiveToken = () =>
      this.db
        .update(refreshTokenFamilies)
        .set({ expiresAt: input.expiresAt, tokenId: input.nextTokenId, updatedAt: now })
        .where(
          and(
            eq(refreshTokenFamilies.familyId, input.familyId),
            eq(refreshTokenFamilies.userId, input.userId),
            eq(refreshTokenFamilies.tokenId, input.previousTokenId),
            isNull(refreshTokenFamilies.revokedAt),
            gt(refreshTokenFamilies.expiresAt, now)
          )
        )
        .returning({ familyId: refreshTokenFamilies.familyId })

    const [rotated] = await updateActiveToken()
    if (rotated) return true

    const existing = await this.db.query.refreshTokenFamilies.findFirst({
      where: eq(refreshTokenFamilies.familyId, input.familyId),
    })

    if (!existing) {
      await this.db
        .insert(refreshTokenFamilies)
        .values({
          expiresAt: input.expiresAt,
          familyId: input.familyId,
          tokenId: input.previousTokenId,
          userId: input.userId,
        })
        .onConflictDoNothing({ target: refreshTokenFamilies.familyId })

      const [claimed] = await updateActiveToken()
      if (claimed) return true
    }

    await this.db
      .update(refreshTokenFamilies)
      .set({ revokedAt: now, updatedAt: now })
      .where(
        and(
          eq(refreshTokenFamilies.familyId, input.familyId),
          eq(refreshTokenFamilies.userId, input.userId),
          ne(refreshTokenFamilies.tokenId, input.previousTokenId),
          isNull(refreshTokenFamilies.revokedAt),
          gt(refreshTokenFamilies.expiresAt, now)
        )
      )

    return false
  }

  revoke = async (input: { expiresAt: Date; familyId: string; tokenId: string; userId: string }) => {
    const now = new Date()
    await this.db
      .insert(refreshTokenFamilies)
      .values({
        expiresAt: input.expiresAt,
        familyId: input.familyId,
        tokenId: input.tokenId,
        userId: input.userId,
      })
      .onConflictDoNothing({ target: refreshTokenFamilies.familyId })

    const [revoked] = await this.db
      .update(refreshTokenFamilies)
      .set({ revokedAt: now, updatedAt: now })
      .where(
        and(
          eq(refreshTokenFamilies.familyId, input.familyId),
          eq(refreshTokenFamilies.userId, input.userId),
          isNull(refreshTokenFamilies.revokedAt)
        )
      )
      .returning({ familyId: refreshTokenFamilies.familyId })

    return Boolean(revoked)
  }

  deleteExpired = async (now = new Date()) => {
    await this.db.delete(refreshTokenFamilies).where(lt(refreshTokenFamilies.expiresAt, now))
  }
}
