import { and, eq, gt, isNull, lt } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import { desktopAuthCodes } from '../schemas'
import type { ChatDatabase } from '../type'

export class DesktopAuthCodeModel {
  constructor(private readonly db: ChatDatabase = getServerDB()) {}

  create = async (input: typeof desktopAuthCodes.$inferInsert) => {
    const [created] = await this.db.insert(desktopAuthCodes).values(input).returning()
    return created
  }

  findValid = async (codeHash: string, now = new Date()) => {
    return this.db.query.desktopAuthCodes.findFirst({
      where: and(
        eq(desktopAuthCodes.codeHash, codeHash),
        isNull(desktopAuthCodes.consumedAt),
        gt(desktopAuthCodes.expiresAt, now)
      ),
    })
  }

  consume = async (codeHash: string, now = new Date()) => {
    const [consumed] = await this.db
      .update(desktopAuthCodes)
      .set({ consumedAt: now })
      .where(
        and(
          eq(desktopAuthCodes.codeHash, codeHash),
          isNull(desktopAuthCodes.consumedAt),
          gt(desktopAuthCodes.expiresAt, now)
        )
      )
      .returning()

    return consumed
  }

  deleteExpired = async (now = new Date()) => {
    await this.db.delete(desktopAuthCodes).where(lt(desktopAuthCodes.expiresAt, now))
  }
}
