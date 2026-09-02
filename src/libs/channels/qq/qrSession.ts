import { randomUUID } from 'node:crypto'

import { startQrConnect } from '@tencent-connect/qqbot-connector'
import type { QrConnectCredentials } from '@tencent-connect/qqbot-connector'
import debug from 'debug'

import { bindQQCredentials } from './binding'

const log = debug('channel:qq:qrcode')
const SESSION_TTL_MS = 10 * 60_000
const QR_START_TIMEOUT_MS = 20_000
const STORE_KEY = Symbol.for('purechat.qq.qr-sessions')

export type QQQrPublicStatus =
  | { qrCodeUrl: string; qrVersion: number; status: 'waiting' }
  | { appIds: string[]; status: 'selecting' }
  | { status: 'binding' }
  | { applicationId: string; status: 'connected' }
  | { message: string; status: 'failed' }

type QQQrSession = {
  agentId: string
  createdAt: number
  credentials?: QrConnectCredentials[]
  expiresAt: number
  id: string
  model?: string
  provider?: string
  publicStatus: QQQrPublicStatus
  stop?: () => void
  ttlTimer?: ReturnType<typeof setTimeout>
  userId: string
}

type GlobalStore = typeof globalThis & { [STORE_KEY]?: Map<string, QQQrSession> }

function getStore(): Map<string, QQQrSession> {
  const globalStore = globalThis as GlobalStore
  globalStore[STORE_KEY] ??= new Map()
  return globalStore[STORE_KEY]
}

function abortError() {
  return new DOMException('Aborted', 'AbortError')
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError()
}

function disposeSession(session: QQQrSession, remove = true) {
  if (remove) getStore().delete(session.id)
  if (session.ttlTimer) clearTimeout(session.ttlTimer)
  session.ttlTimer = undefined
  session.stop?.()
  session.stop = undefined
}

function cleanupExpiredSessions() {
  const now = Date.now()
  for (const session of getStore().values()) {
    if (session.expiresAt <= now) disposeSession(session)
  }
}

function getOwnedSession(userId: string, sessionId: string): QQQrSession | undefined {
  cleanupExpiredSessions()
  const session = getStore().get(sessionId)
  return session?.userId === userId ? session : undefined
}

function bindParamsFromSession(
  session: QQQrSession,
  credential: QrConnectCredentials,
  userId = session.userId
) {
  return {
    agentId: session.agentId,
    appId: credential.appId,
    appSecret: credential.appSecret,
    connectionMode: 'websocket' as const,
    userId,
    ...(session.model ? { model: session.model } : {}),
    ...(session.provider ? { provider: session.provider } : {}),
  }
}

async function completeSingleCredential(session: QQQrSession, credential: QrConnectCredentials) {
  session.publicStatus = { status: 'binding' }
  try {
    const binding = await bindQQCredentials(bindParamsFromSession(session, credential))
    session.credentials = undefined
    session.publicStatus = { applicationId: binding.applicationId, status: 'connected' }
  } catch (error) {
    log('automatic QR binding failed userId=%s: %O', session.userId, error)
    session.credentials = undefined
    session.publicStatus = { message: error instanceof Error ? error.message : 'QQ 绑定失败', status: 'failed' }
  }
}

export async function startQQQrSession(
  userId: string,
  agentId: string,
  config?: { model?: string; provider?: string },
  signal?: AbortSignal
) {
  throwIfAborted(signal)
  cleanupExpiredSessions()

  const session: QQQrSession = {
    agentId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    id: randomUUID(),
    model: config?.model,
    provider: config?.provider,
    publicStatus: { qrCodeUrl: '', qrVersion: 0, status: 'waiting' },
    userId,
  }
  getStore().set(session.id, session)
  session.ttlTimer = setTimeout(() => disposeSession(session), SESSION_TTL_MS)
  session.ttlTimer.unref?.()

  let abortHandler: (() => void) | undefined
  const firstQr = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('获取 QQ 二维码超时')), QR_START_TIMEOUT_MS)
    timeout.unref?.()
    let displayed = false
    const onAbort = () => {
      clearTimeout(timeout)
      disposeSession(session)
      reject(abortError())
    }
    abortHandler = onAbort

    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    session.stop = startQrConnect(
      {
        onFailure(error) {
          if (!displayed) {
            clearTimeout(timeout)
            reject(error)
          }
          if (!getStore().has(session.id)) return
          log('QR connector failed userId=%s: %O', session.userId, error)
          session.publicStatus = { message: 'QQ 扫码连接失败，请重试', status: 'failed' }
        },
        onQrDisplayed(url) {
          if (!getStore().has(session.id)) return
          const previousVersion = session.publicStatus.status === 'waiting' ? session.publicStatus.qrVersion : 0
          session.publicStatus = { qrCodeUrl: url, qrVersion: previousVersion + 1, status: 'waiting' }
          if (!displayed) {
            displayed = true
            clearTimeout(timeout)
            resolve()
          }
        },
        onSuccess(credentials) {
          if (!getStore().has(session.id)) return
          session.stop = undefined
          session.credentials = credentials
          if (credentials.length === 1) {
            void completeSingleCredential(session, credentials[0])
          } else if (credentials.length > 1) {
            session.publicStatus = { appIds: credentials.map(({ appId }) => appId), status: 'selecting' }
          } else {
            session.publicStatus = { message: '未获取到 QQ 机器人凭证', status: 'failed' }
          }
        },
      },
      { displayQrCodeToConsole: false }
    )
  })

  try {
    await firstQr
    throwIfAborted(signal)
    return { sessionId: session.id, ...session.publicStatus }
  } catch (error) {
    disposeSession(session)
    throw error
  } finally {
    if (abortHandler) signal?.removeEventListener('abort', abortHandler)
  }
}

export function getQQQrSessionStatus(userId: string, sessionId: string): QQQrPublicStatus | undefined {
  return getOwnedSession(userId, sessionId)?.publicStatus
}

export async function completeQQQrSession(userId: string, sessionId: string, appId: string) {
  const session = getOwnedSession(userId, sessionId)
  if (!session) return undefined
  if (session.publicStatus.status !== 'selecting' || !session.credentials) {
    throw new Error('QQ 扫码会话当前不可完成')
  }
  const credential = session.credentials.find((item) => item.appId === appId)
  if (!credential) throw new Error('请选择扫码授权返回的 QQ 机器人')

  session.publicStatus = { status: 'binding' }
  try {
    const binding = await bindQQCredentials(bindParamsFromSession(session, credential, userId))
    session.credentials = undefined
    session.publicStatus = { applicationId: binding.applicationId, status: 'connected' }
    return binding
  } catch (error) {
    session.credentials = undefined
    session.publicStatus = { message: error instanceof Error ? error.message : 'QQ 绑定失败', status: 'failed' }
    throw error
  }
}

export function cancelQQQrSession(userId: string, sessionId: string): boolean {
  const session = getOwnedSession(userId, sessionId)
  if (!session) return false
  disposeSession(session)
  return true
}

/** 断开 QQ 绑定时清理该用户仍在运行的扫码会话，避免旧连接回调干扰下一次扫码。 */
export function cancelQQQrSessionsForUser(userId: string): number {
  cleanupExpiredSessions()
  let canceled = 0
  for (const session of [...getStore().values()]) {
    if (session.userId !== userId) continue
    disposeSession(session)
    canceled += 1
  }
  return canceled
}

export function clearQQQrSessionsForTests() {
  for (const session of getStore().values()) disposeSession(session)
}
