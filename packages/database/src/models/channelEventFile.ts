import { and, asc, desc, eq } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import { channelEventFiles } from '../schemas/channel'
import { files } from '../schemas/file'
import type { NewChannelEventFile } from '../schemas/channel'
import type { ChatDatabase } from '../type'

export class ChannelEventFileModel {
  constructor(private readonly db: ChatDatabase = getServerDB()) {}

  assertReady = async () => {
    await this.db.select({ id: channelEventFiles.id }).from(channelEventFiles).limit(1)
  }

  findByOperation = async (eventId: string, direction: string, operationHash: string) => {
    const [row] = await this.db
      .select({ artifact: channelEventFiles, file: files })
      .from(channelEventFiles)
      .innerJoin(files, eq(channelEventFiles.fileId, files.id))
      .where(
        and(
          eq(channelEventFiles.eventId, eventId),
          eq(channelEventFiles.direction, direction),
          eq(channelEventFiles.operationHash, operationHash)
        )
      )
      .limit(1)
    return row ?? null
  }

  create = async (data: Omit<NewChannelEventFile, 'id'>) => {
    const [created] = await this.db
      .insert(channelEventFiles)
      .values(data)
      .onConflictDoNothing({
        target: [channelEventFiles.eventId, channelEventFiles.direction, channelEventFiles.operationHash],
      })
      .returning()
    return created ?? (await this.findByOperation(data.eventId, data.direction, data.operationHash))?.artifact ?? null
  }

  listForEvent = async (eventId: string) =>
    this.db
      .select({ artifact: channelEventFiles, file: files })
      .from(channelEventFiles)
      .innerJoin(files, eq(channelEventFiles.fileId, files.id))
      .where(eq(channelEventFiles.eventId, eventId))
      .orderBy(asc(channelEventFiles.createdAt))

  listForConversation = async (sessionId: string, conversationVersion: number) =>
    this.db
      .select({ artifact: channelEventFiles, file: files })
      .from(channelEventFiles)
      .innerJoin(files, eq(channelEventFiles.fileId, files.id))
      .where(
        and(
          eq(channelEventFiles.sessionId, sessionId),
          eq(channelEventFiles.conversationVersion, conversationVersion)
        )
      )
      .orderBy(desc(channelEventFiles.createdAt))

  markSending = async (id: string) => {
    await this.db
      .update(channelEventFiles)
      .set({ deliveryError: null, deliveryStatus: 'sending', updatedAt: new Date() })
      .where(and(eq(channelEventFiles.id, id), eq(channelEventFiles.deliveryStatus, 'pending')))
  }

  markSent = async (id: string) => {
    const now = new Date()
    await this.db
      .update(channelEventFiles)
      .set({ deliveryError: null, deliveryStatus: 'sent', sentAt: now, updatedAt: now })
      .where(eq(channelEventFiles.id, id))
  }

  markFailed = async (id: string, error: string) => {
    await this.db
      .update(channelEventFiles)
      .set({ deliveryError: error.slice(0, 500), deliveryStatus: 'pending', updatedAt: new Date() })
      .where(eq(channelEventFiles.id, id))
  }
}
