import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import {
  isWechatProviderId,
  validateWechatModel,
  wechatAgentUnavailableReason,
} from '@/libs/channels/wechat/agentSupport'
import {
  encryptCredentials,
  invalidateWechatChat,
  isWechatGatewaySupported,
  requireWechatVaultSecret,
} from '@/libs/channels/wechat'
import type { WechatCredentials } from '@/libs/channels/wechat'

const requestGatewayReconcile = async () => {
  const { reconcileChannelGateway } = await import('@/server/channel-gateway')
  await reconcileChannelGateway()
}

const bindSchema = z.object({
  agentId: z.string().trim().min(1).max(128),
  botId: z.string().trim().max(255).optional().default(''),
  botToken: z.string().trim().min(16).max(4096),
  model: z.string().trim().min(1).max(255),
  provider: z.string().trim().min(1).max(32),
  userId: z.string().trim().max(255).optional().default(''),
})
const patchSchema = bindSchema.pick({ agentId: true, model: true, provider: true })

async function validateConfiguration(userId: string, config: z.infer<typeof patchSchema>) {
  const agent = await new AgentModel(userId).findVisibleById(config.agentId)
  if (!agent) return { error: 'Agent not found', status: 404 } as const
  if (!isWechatProviderId(config.provider)) return { error: '该 Provider 不支持微信渠道', status: 400 } as const
  const unavailable = wechatAgentUnavailableReason(config.provider)
  if (unavailable) return { error: unavailable, status: 400 } as const
  const modelError = validateWechatModel(config.provider, config.model)
  if (modelError) return { error: modelError, status: 400 } as const
  return null
}

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  if (!isWechatGatewaySupported()) return jsonError('当前部署不支持微信 Gateway，请使用 Docker 或本地 Gateway', 503)
  try {
    requireWechatVaultSecret()
  } catch {
    return jsonError('服务器未配置 KEY_VAULTS_SECRET，无法安全绑定微信', 503)
  }

  const parsed = bindSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError('Invalid bind request')
  const { agentId, botId, botToken, model: modelId, provider } = parsed.data
  const invalid = await validateConfiguration(userId, parsed.data)
  if (invalid) return jsonError(invalid.error, invalid.status)

  const credentials: WechatCredentials = { botId, botToken, userId: parsed.data.userId }
  const applicationId = botId || `wechat_${createHash('sha256').update(botToken).digest('hex').slice(0, 32)}`
  const model = new ChannelBindingModel()
  const previous = await model.findByUserAndPlatform(userId, WECHAT_PLATFORM)
  if (previous?.applicationId) invalidateWechatChat(previous.applicationId)
  const binding = await model.upsert({
    agentId,
    applicationId,
    credentials: encryptCredentials(credentials),
    model: modelId,
    platform: WECHAT_PLATFORM,
    provider,
    userId,
  })
  await requestGatewayReconcile()
  return NextResponse.json({ id: binding.id, ok: true, runtimeStatus: binding.runtimeStatus })
})

export const DELETE = withAuth(async (_request, { userId }) => {
  const model = new ChannelBindingModel()
  const existing = await model.findByUserAndPlatform(userId, WECHAT_PLATFORM)
  if (existing?.applicationId) invalidateWechatChat(existing.applicationId)
  await model.disconnect(userId, WECHAT_PLATFORM)
  await requestGatewayReconcile()
  return NextResponse.json({ ok: true })
})

export const PATCH = withAuth(async (request: NextRequest, { userId }) => {
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError('Invalid agent request')
  const invalid = await validateConfiguration(userId, parsed.data)
  if (invalid) return jsonError(invalid.error, invalid.status)
  const updated = await new ChannelBindingModel().updateConfiguration({
    ...parsed.data,
    platform: WECHAT_PLATFORM,
    userId,
  })
  if (!updated) return jsonError('WeChat not connected', 404)
  invalidateWechatChat(updated.applicationId)
  return NextResponse.json({ agentId: updated.agentId, model: updated.model, ok: true, provider: updated.provider })
})
