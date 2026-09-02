import { NextResponse } from 'next/server'

import { ChatTopicShareModel } from '@pure/database/models/chatTopicShare'
import { jsonError } from '@/libs/auth/get-session-user'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/share/t/[id]
 * 读取公开 Topic 分享内容，不要求登录。
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params
  if (!/^[0-9a-zA-Z]{8}$/.test(id)) return jsonError('Share not found', 404)

  const share = await ChatTopicShareModel.getPublicByShareId(id)
  if (!share) return jsonError('Share not found', 404)

  return NextResponse.json(share)
}
