import { and, eq } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import { chatToolApprovals } from '../schemas/chat'
import type { ChatDatabase } from '../type'

export type ChatToolApprovalStatus = 'pending' | 'approved' | 'denied' | 'completed' | 'failed'

export class ChatToolApprovalModel {
  constructor(
    private readonly userId: string,
    private readonly db: ChatDatabase = getServerDB()
  ) {}

  find = async (topicId: string, toolCallId: string) =>
    this.db.query.chatToolApprovals.findFirst({
      where: and(
        eq(chatToolApprovals.userId, this.userId),
        eq(chatToolApprovals.topicId, topicId),
        eq(chatToolApprovals.toolCallId, toolCallId)
      ),
    })

  upsertPending = async (input: {
    apiName: string
    args: Record<string, unknown>
    argsHash: string
    identifier: string
    topicId: string
    toolCallId: string
  }) => {
    const existing = await this.find(input.topicId, input.toolCallId)
    if (existing) return existing

    const [created] = await this.db
      .insert(chatToolApprovals)
      .values({ userId: this.userId, ...input })
      .returning()
    return created
  }

  updateStatus = async (topicId: string, toolCallId: string, status: ChatToolApprovalStatus, error?: string) => {
    const now = new Date()
    const [updated] = await this.db
      .update(chatToolApprovals)
      .set({
        ...(status === 'approved' ? { approvedAt: now } : {}),
        ...(status === 'completed' || status === 'failed' ? { completedAt: now } : {}),
        ...(error !== undefined ? { error } : {}),
        status,
        updatedAt: now,
      })
      .where(
        and(
          eq(chatToolApprovals.userId, this.userId),
          eq(chatToolApprovals.topicId, topicId),
          eq(chatToolApprovals.toolCallId, toolCallId)
        )
      )
      .returning()
    return updated
  }

  listPending = async (topicId: string) =>
    this.db.query.chatToolApprovals.findMany({
      where: and(
        eq(chatToolApprovals.userId, this.userId),
        eq(chatToolApprovals.topicId, topicId),
        eq(chatToolApprovals.status, 'pending')
      ),
    })
}
