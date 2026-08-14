import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { AgentModel } from '@pure/database/models/agent'
import { gatewayEnv } from '@/envs/gateway'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { QQBindingError } from '@/libs/channels/qq/binding'
import { cancelQQQrSession, completeQQQrSession, getQQQrSessionStatus, startQQQrSession } from '@/libs/channels/qq/qrSession'

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  if (!gatewayEnv.CHANNEL_GATEWAY_ENABLED) {
    return jsonError('当前部署不支持 QQ 扫码连接，请使用 URL 回调', 409)
  }

  let body: { action?: string; agentId?: string; appId?: string; model?: string; provider?: string; sessionId?: string }
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid JSON body')
  }

  if (body.action === 'complete') {
    const appId = body.appId?.trim()
    const sessionId = body.sessionId?.trim()
    if (!sessionId) return jsonError('sessionId is required')
    if (!appId) return jsonError('appId is required')
    try {
      const binding = await completeQQQrSession(userId, sessionId, appId)
      if (!binding) return jsonError('QQ 扫码会话不存在或已过期', 404)
      return NextResponse.json(binding)
    } catch (error) {
      if (error instanceof QQBindingError) return jsonError(error.message, error.status)
      return jsonError(error instanceof Error ? error.message : 'QQ 绑定失败')
    }
  }

  const agentId = body.agentId?.trim()
  if (!agentId) return jsonError('agentId is required')
  if (!(await new AgentModel(userId).findVisibleById(agentId))) return jsonError('Agent not found', 404)

  try {
    const model = body.model?.trim()
    const provider = body.provider?.trim()
    if (model || provider) {
      return NextResponse.json(await startQQQrSession(userId, agentId, { model, provider }))
    }
    return NextResponse.json(await startQQQrSession(userId, agentId))
  } catch {
    return jsonError('获取 QQ 二维码失败，请稍后重试', 502)
  }
})

export const GET = withAuth(async (request: NextRequest, { userId }) => {
  const sessionId = request.nextUrl.searchParams.get('sessionId')?.trim()
  if (!sessionId) return jsonError('sessionId is required')
  const status = getQQQrSessionStatus(userId, sessionId)
  if (!status) return jsonError('QQ 扫码会话不存在或已过期', 404)
  return NextResponse.json(status)
})

export const DELETE = withAuth(async (request: NextRequest, { userId }) => {
  const sessionId = request.nextUrl.searchParams.get('sessionId')?.trim()
  if (!sessionId) return jsonError('sessionId is required')
  cancelQQQrSession(userId, sessionId)
  return NextResponse.json({ ok: true })
})
