import { waitUntil } from '@vercel/functions'
import { type NextRequest, NextResponse } from 'next/server'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import {
  DEFAULT_DURATION_MS,
  encryptCredentials,
  invalidateWechatChat,
  pollBinding,
  type WechatCredentials,
} from '@/libs/channels/wechat'

export const maxDuration = 300

/** POST /api/channels/wechat/bind — 保存扫码凭证并启动一轮轮询 */
export const POST = withAuth(async (request: NextRequest, { userId }) => {
  let body: {
    agentId?: string
    botId?: string
    botToken?: string
    userId?: string
  }

  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid JSON body')
  }

  const botToken = body.botToken?.trim()
  const agentId = body.agentId?.trim()
  if (!botToken) return jsonError('botToken is required')
  if (!agentId) return jsonError('agentId is required')

  const agentModel = new AgentModel(userId)
  const agent = await agentModel.findVisibleById(agentId)
  if (!agent) return jsonError('Agent not found', 404)

  const credentials: WechatCredentials = {
    botId: body.botId?.trim() || '',
    botToken,
    userId: body.userId?.trim() || '',
  }

  const applicationId = credentials.botId || botToken.slice(0, 16)
  const model = new ChannelBindingModel()

  const previous = await model.findByUserAndPlatform(userId, 'wechat')
  if (previous?.applicationId) {
    invalidateWechatChat(previous.applicationId)
  }

  const binding = await model.upsertWechat({
    agentId,
    applicationId,
    credentials: encryptCredentials(credentials),
    userId,
  })

  // Kick off a poll window immediately (Vercel waitUntil / best-effort)
  waitUntil(
    pollBinding(binding, { durationMs: DEFAULT_DURATION_MS }).catch(() => {
      /* logged inside poller */
    })
  )

  return NextResponse.json({
    agentId: binding.agentId,
    applicationId: binding.applicationId,
    enabled: binding.enabled,
    id: binding.id,
    needsRebind: binding.needsRebind,
    ok: true,
  })
})

/** DELETE /api/channels/wechat/bind — 断开微信连接 */
export const DELETE = withAuth(async (_request, { userId }) => {
  const model = new ChannelBindingModel()
  const existing = await model.findByUserAndPlatform(userId, 'wechat')
  if (existing?.applicationId) {
    invalidateWechatChat(existing.applicationId)
  }
  await model.disconnect(userId, WECHAT_PLATFORM)
  return NextResponse.json({ ok: true })
})

/** PATCH /api/channels/wechat/bind — 更新绑定的 Agent */
export const PATCH = withAuth(async (request: NextRequest, { userId }) => {
  let body: { agentId?: string }
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid JSON body')
  }

  const agentId = body.agentId?.trim()
  if (!agentId) return jsonError('agentId is required')

  const agentModel = new AgentModel(userId)
  const agent = await agentModel.findVisibleById(agentId)
  if (!agent) return jsonError('Agent not found', 404)

  const model = new ChannelBindingModel()
  const existing = await model.findByUserAndPlatform(userId, WECHAT_PLATFORM)
  if (existing?.applicationId) {
    invalidateWechatChat(existing.applicationId)
  }

  const updated = await model.updateAgent(userId, WECHAT_PLATFORM, agentId)
  if (!updated) return jsonError('WeChat not connected', 404)

  return NextResponse.json({
    agentId: updated.agentId,
    ok: true,
  })
})
