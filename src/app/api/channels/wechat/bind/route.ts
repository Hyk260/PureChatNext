import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { wechatAgentUnavailableReason } from '@/libs/channels/wechat/agentSupport'
import {
  encryptCredentials,
  invalidateWechatChat,
  isWechatGatewaySupported,
  requireWechatVaultSecret,
} from '@/libs/channels/wechat'
import type { WechatCredentials } from '@/libs/channels/wechat'

const bindSchema = z.object({
  agentId: z.string().trim().min(1).max(128),
  botId: z.string().trim().max(255).optional().default(''),
  botToken: z.string().trim().min(16).max(4096),
  userId: z.string().trim().max(255).optional().default(''),
})
const patchSchema = z.object({ agentId: z.string().trim().min(1).max(128) })

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  if (!isWechatGatewaySupported()) return jsonError('当前部署不支持微信 Gateway，请使用 Docker 或本地 Gateway', 503)
  try {
    requireWechatVaultSecret()
  } catch {
    return jsonError('服务器未配置 KEY_VAULTS_SECRET，无法安全绑定微信', 503)
  }

  const parsed = bindSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError('Invalid bind request')
  const { agentId, botId, botToken } = parsed.data
  const agent = await new AgentModel(userId).findVisibleById(agentId)
  if (!agent) return jsonError('Agent not found', 404)
  const unavailable = wechatAgentUnavailableReason(agent.provider)
  if (unavailable) return jsonError(unavailable, 400)

  const credentials: WechatCredentials = { botId, botToken, userId: parsed.data.userId }
  const applicationId = botId || `wechat_${createHash('sha256').update(botToken).digest('hex').slice(0, 32)}`
  const model = new ChannelBindingModel()
  const previous = await model.findByUserAndPlatform(userId, WECHAT_PLATFORM)
  if (previous?.applicationId) invalidateWechatChat(previous.applicationId)
  const binding = await model.upsertWechat({
    agentId,
    applicationId,
    credentials: encryptCredentials(credentials),
    userId,
  })
  return NextResponse.json({ id: binding.id, ok: true, runtimeStatus: binding.runtimeStatus })
})

export const DELETE = withAuth(async (_request, { userId }) => {
  const model = new ChannelBindingModel()
  const existing = await model.findByUserAndPlatform(userId, WECHAT_PLATFORM)
  if (existing?.applicationId) invalidateWechatChat(existing.applicationId)
  await model.disconnect(userId, WECHAT_PLATFORM)
  return NextResponse.json({ ok: true })
})

export const PATCH = withAuth(async (request: NextRequest, { userId }) => {
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError('Invalid agent request')
  const agent = await new AgentModel(userId).findVisibleById(parsed.data.agentId)
  if (!agent) return jsonError('Agent not found', 404)
  const unavailable = wechatAgentUnavailableReason(agent.provider)
  if (unavailable) return jsonError(unavailable, 400)
  const updated = await new ChannelBindingModel().updateAgent(userId, WECHAT_PLATFORM, parsed.data.agentId)
  if (!updated) return jsonError('WeChat not connected', 404)
  return NextResponse.json({ agentId: updated.agentId, ok: true })
})
