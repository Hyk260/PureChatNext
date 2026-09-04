import { waitUntil } from '@vercel/functions'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { QQ_OP_CODES, signWebhookResponse, verifyWebhookSignature } from '@pure/chat-adapter/qq'
import { decryptCredentials } from '@/libs/channels/qq/encrypt'
import { authorizeQQInternalWebhook } from '@/libs/channels/qq/webhookAuth'
import { logger } from '@/libs/logger'

export const maxDuration = 300
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ applicationId: string }> }

type QQWebhookProbe = {
  d?: {
    event_ts?: unknown
    plain_token?: unknown
  }
  op?: unknown
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value === 'string' && value) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function isQQVerifyOp(op: unknown): boolean {
  return Number(op) === QQ_OP_CODES.VERIFY
}

function summarizeQQWebhookRequest(request: NextRequest, payload: QQWebhookProbe | null, bodyText: string) {
  return {
    bodyBytes: Buffer.byteLength(bodyText),
    ...(process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development'
      ? { bodyPreview: payload }
      : {}),
    contentLength: request.headers.get('content-length'),
    contentType: request.headers.get('content-type'),
    eventTsType: payload?.d?.event_ts === undefined ? 'missing' : typeof payload.d.event_ts,
    hasEd25519: Boolean(request.headers.get('X-Signature-Ed25519')),
    hasTimestamp: Boolean(request.headers.get('X-Signature-Timestamp')),
    op: payload?.op ?? null,
    plainTokenType: payload?.d?.plain_token === undefined ? 'missing' : typeof payload.d.plain_token,
    transferEncoding: request.headers.get('transfer-encoding'),
    userAgent: request.headers.get('user-agent'),
    xBotAppid: request.headers.get('X-Bot-Appid'),
  }
}

function logQQWebhook(
  applicationId: string,
  request: NextRequest,
  payload: QQWebhookProbe | null,
  bodyText: string,
  extra: Record<string, unknown>
) {
  const summary = { applicationId, ...summarizeQQWebhookRequest(request, payload, bodyText), ...extra }
  logger.info(summary, 'qq webhook inbound')
}

function logQQWebhookPost(
  applicationId: string,
  request: NextRequest,
  payload: QQWebhookProbe | null,
  bodyText: string,
  extra: Record<string, unknown>
) {
  logQQWebhook(applicationId, request, payload, bodyText, { method: 'POST', ...extra })
}

async function readQQWebhookBody(
  request: NextRequest
): Promise<{ bodyText: string; payload: QQWebhookProbe | null }> {
  // 只读一次原始 body。Next 16 Proxy 会缓冲请求体供路由使用；再 clone() 在
  // 本地隧道和 Vercel Function 上都可能得到空串，导致 op=13 走成验签失败。
  const bodyText = await request.text()

  try {
    const payload: unknown = JSON.parse(bodyText)
    return {
      bodyText,
      payload: payload && typeof payload === 'object' ? (payload as QQWebhookProbe) : null,
    }
  } catch {
    return { bodyText, payload: null }
  }
}

type ReplayRequestInit = RequestInit & { duplex: 'half' }

/** 把已消费的 body 重放成新 Request，供 Chat SDK 再读；duplex 是 Vercel/undici 发带 body 的 Request 所必需。 */
function replayQQWebhookRequest(request: NextRequest, bodyText: string) {
  const init: ReplayRequestInit = {
    body: bodyText,
    duplex: 'half',
    headers: request.headers,
    method: request.method,
  }
  return new Request(request.url, init)
}

function methodNotAllowed() {
  return new NextResponse(null, { headers: { Allow: 'POST' }, status: 405 })
}

/**
 * GET /api/channels/qq/webhook/[applicationId]
 * QQ 校验只用 POST；记录控制台/隧道的 URL 探测，避免无日志的 405。
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { applicationId } = await context.params
  logQQWebhook(applicationId, request, null, '', { method: request.method, reason: 'probe' })
  return methodNotAllowed()
}

export const HEAD = GET

/**
 * POST /api/channels/qq/webhook/[applicationId]
 * QQ 开放平台推送（webhook）或 Gateway 转发（websocket）
 *
 * 鉴权：websocket 内部 Gateway 校验 Bearer；webhook 事件校验 QQ Ed25519 签名；
 * op=13 在内部 Bearer 和事件验签之前直接签名响应。
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { applicationId } = await context.params
  if (!applicationId?.trim()) {
    return NextResponse.json({ error: 'applicationId required' }, { status: 400 })
  }

  try {
    const { bodyText, payload } = await readQQWebhookBody(request)
    if (!bodyText) {
      logQQWebhookPost(applicationId, request, payload, bodyText, {
        reason: 'empty-body',
        status: 400,
      })
      return NextResponse.json({ error: 'Empty body' }, { status: 400 })
    }

    const bindingLookupStartedAt = performance.now()
    const { ChannelBindingModel, QQ_PLATFORM } = await import(
      '@pure/database/models/channelBinding'
    )
    const model = new ChannelBindingModel()
    const binding = await model.findByApplicationId(QQ_PLATFORM, applicationId)
    const bindingLookupDuration = performance.now() - bindingLookupStartedAt
    if (!binding || !binding.enabled) {
      logQQWebhookPost(applicationId, request, payload, bodyText, {
        reason: 'binding-missing',
        status: 404,
      })
      return NextResponse.json({ error: 'Binding not found' }, { status: 404 })
    }

    const credentials = decryptCredentials(binding.credentials)
    const botAppId = request.headers.get('X-Bot-Appid')
    const appIdMismatch =
      Boolean(botAppId) && botAppId !== credentials.appId && botAppId !== binding.applicationId
    const authorizedLog = (extra: Record<string, unknown>) =>
      logQQWebhookPost(applicationId, request, payload, bodyText, {
        appIdMismatch,
        connectionMode: credentials.connectionMode,
        ...extra,
      })

    if (isQQVerifyOp(payload?.op)) {
      const eventTs = asNonEmptyString(payload?.d?.event_ts)
      const plainToken = asNonEmptyString(payload?.d?.plain_token)
      if (!eventTs || !plainToken) {
        authorizedLog({
          reason: 'verify-missing-fields',
          secretLength: credentials.appSecret.length,
          status: 400,
        })
        return new NextResponse('Missing verification data', { status: 400 })
      }

      const signingStartedAt = performance.now()
      const response = NextResponse.json({
        plain_token: plainToken,
        signature: signWebhookResponse(eventTs, plainToken, credentials.appSecret),
      })
      const signingDuration = performance.now() - signingStartedAt
      authorizedLog({
        reason: 'verify-signed',
        secretLength: credentials.appSecret.length,
        signingDuration,
        status: 200,
      })
      response.headers.set(
        'Server-Timing',
        `binding;dur=${bindingLookupDuration.toFixed(1)}, sign;dur=${signingDuration.toFixed(1)}`
      )
      return response
    }

    if (credentials.connectionMode === 'websocket' && !authorizeQQInternalWebhook(request)) {
      authorizedLog({ reason: 'internal-unauthorized', status: 401 })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (credentials.connectionMode === 'webhook') {
      const signature = request.headers.get('X-Signature-Ed25519')
      const timestamp = request.headers.get('X-Signature-Timestamp')
      if (
        !signature ||
        !timestamp ||
        !verifyWebhookSignature(bodyText, timestamp, signature, credentials.appSecret)
      ) {
        authorizedLog({
          reason: 'event-signature-invalid',
          secretLength: credentials.appSecret.length,
          status: 401,
        })
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    authorizedLog({ reason: 'dispatch', status: 200 })

    const { getOrCreateQQChat } = await import('@/libs/channels/qq/chatBot')

    const chat = await getOrCreateQQChat({
      agentId: binding.agentId,
      appId: credentials.appId,
      appSecret: credentials.appSecret,
      applicationId: binding.applicationId,
      bindingId: binding.id,
      model: binding.model,
      provider: binding.provider,
      userId: binding.userId,
    })

    await model.touchActive(binding.id)

    const response = await chat.webhooks.qq(replayQQWebhookRequest(request, bodyText), { waitUntil })
    return response
  } catch (error) {
    logger.error({ applicationId, error }, 'qq webhook failed')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
