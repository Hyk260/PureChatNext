import { NextResponse } from 'next/server'

import { ChatTopicShareModel } from '@pure/database/models/chatTopicShare'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

/**
 * POST /api/chat/topics/[id]/share
 * 创建或复用当前用户的 Topic 分享链接。
 */
export const POST = withAuth(async (_request, { params, userId }) => {
  const { id } = await params
  const share = await new ChatTopicShareModel(userId).create(id)
  if (!share) return jsonError('Topic not found', 404)

  return NextResponse.json({ shareId: share.id })
})
