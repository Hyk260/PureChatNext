import { QQ_MAX_TEXT_LENGTH, chunkQQText } from '@pure/chat-adapter/qq'
import type { ChannelAccessPolicy, ChannelAllowedUser, ChannelBindingSettings } from '@pure/database/schemas/channel'

import type { QQThreadType } from './thread'

export type QQAccessPolicy = ChannelAccessPolicy
export type QQAllowedUser = ChannelAllowedUser

export type QQChannelSettings = {
  allowedUsers: QQAllowedUser[]
  charLimit: number
  dmPolicy: QQAccessPolicy
  groupPolicy: QQAccessPolicy
  platformUserId: string
}

/** QQ OpenAPI outbound text hard limit — single source from `@pure/chat-adapter/qq`. */
export const QQ_PLATFORM_MAX_TEXT_LENGTH = QQ_MAX_TEXT_LENGTH
export const QQ_DEFAULT_CHAR_LIMIT = QQ_PLATFORM_MAX_TEXT_LENGTH
export const QQ_MIN_CHAR_LIMIT = 1

export const DEFAULT_QQ_CHANNEL_SETTINGS: QQChannelSettings = {
  allowedUsers: [],
  charLimit: QQ_DEFAULT_CHAR_LIMIT,
  dmPolicy: 'open',
  groupPolicy: 'open',
  platformUserId: '',
}

const ACCESS_POLICIES = new Set<QQAccessPolicy>(['open', 'allowlist', 'disabled'])

function isAccessPolicy(value: unknown): value is QQAccessPolicy {
  return typeof value === 'string' && ACCESS_POLICIES.has(value as QQAccessPolicy)
}

function normalizeAllowedUsers(value: unknown): QQAllowedUser[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const users: QQAllowedUser[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const platformUserId =
      typeof (entry as { platformUserId?: unknown }).platformUserId === 'string'
        ? (entry as { platformUserId: string }).platformUserId.trim()
        : ''
    if (!platformUserId || seen.has(platformUserId)) continue
    seen.add(platformUserId)
    const remarkRaw = (entry as { remark?: unknown }).remark
    const remark = typeof remarkRaw === 'string' ? remarkRaw.trim().slice(0, 120) : ''
    users.push(remark ? { platformUserId, remark } : { platformUserId })
  }
  return users
}

function clampCharLimit(value: unknown): number {
  const raw = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(raw)) return QQ_DEFAULT_CHAR_LIMIT
  return Math.min(QQ_PLATFORM_MAX_TEXT_LENGTH, Math.max(QQ_MIN_CHAR_LIMIT, Math.round(raw)))
}

/** Normalize persisted / API payloads into a complete settings object. */
export function normalizeQQChannelSettings(raw?: ChannelBindingSettings | null): QQChannelSettings {
  return {
    allowedUsers: normalizeAllowedUsers(raw?.allowedUsers),
    charLimit: clampCharLimit(raw?.charLimit),
    dmPolicy: isAccessPolicy(raw?.dmPolicy) ? raw.dmPolicy : DEFAULT_QQ_CHANNEL_SETTINGS.dmPolicy,
    groupPolicy: isAccessPolicy(raw?.groupPolicy) ? raw.groupPolicy : DEFAULT_QQ_CHANNEL_SETTINGS.groupPolicy,
    platformUserId: typeof raw?.platformUserId === 'string' ? raw.platformUserId.trim() : '',
  }
}

/**
 * Validate + normalize a settings object into a complete `QQChannelSettings`.
 * Callers doing PATCH must merge over existing settings first — omitted fields
 * are filled with defaults and would otherwise wipe persisted values.
 */
export function parseQQChannelSettingsInput(raw: unknown):
  | { ok: true; settings: QQChannelSettings }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'settings is required' }
  const body = raw as Record<string, unknown>
  if (body.dmPolicy !== undefined && !isAccessPolicy(body.dmPolicy)) {
    return { ok: false, error: 'Invalid dmPolicy' }
  }
  if (body.groupPolicy !== undefined && !isAccessPolicy(body.groupPolicy)) {
    return { ok: false, error: 'Invalid groupPolicy' }
  }
  if (body.charLimit !== undefined) {
    const n = typeof body.charLimit === 'number' ? body.charLimit : Number(body.charLimit)
    if (!Number.isFinite(n) || n < QQ_MIN_CHAR_LIMIT || n > QQ_PLATFORM_MAX_TEXT_LENGTH) {
      return { ok: false, error: `charLimit must be between ${QQ_MIN_CHAR_LIMIT} and ${QQ_PLATFORM_MAX_TEXT_LENGTH}` }
    }
  }
  if (body.platformUserId !== undefined && typeof body.platformUserId !== 'string') {
    return { ok: false, error: 'Invalid platformUserId' }
  }
  if (body.allowedUsers !== undefined && !Array.isArray(body.allowedUsers)) {
    return { ok: false, error: 'Invalid allowedUsers' }
  }
  return {
    ok: true,
    settings: normalizeQQChannelSettings({
      allowedUsers: body.allowedUsers as ChannelAllowedUser[] | undefined,
      charLimit: body.charLimit as number | undefined,
      dmPolicy: body.dmPolicy as QQAccessPolicy | undefined,
      groupPolicy: body.groupPolicy as QQAccessPolicy | undefined,
      platformUserId: body.platformUserId as string | undefined,
    }),
  }
}

export function isQQDirectThread(threadType: QQThreadType) {
  return threadType === 'c2c' || threadType === 'dms'
}

function isOwner(settings: QQChannelSettings, authorId: string) {
  const ownerId = settings.platformUserId.trim()
  return Boolean(ownerId && ownerId === authorId)
}

function isAllowlisted(settings: QQChannelSettings, authorId: string) {
  if (isOwner(settings, authorId)) return true
  return settings.allowedUsers.some((user) => user.platformUserId === authorId)
}

export type QQInboundAccessDecision =
  | { ok: true }
  | { notice: string; ok: false; reason: 'allowlist' | 'disabled' }

/**
 * Evaluate DM / group access for an inbound QQ author.
 * - disabled: reject everyone including owner
 * - allowlist: empty list fails closed; owner is implicitly trusted
 * - open: accept anyone（白名单仅在 allowlist 策略下生效）
 */
export function evaluateQQInboundAccess(params: {
  authorId: string
  settings: QQChannelSettings
  threadType: QQThreadType
}): QQInboundAccessDecision {
  const authorId = params.authorId.trim()
  const isDm = isQQDirectThread(params.threadType)
  const policy = isDm ? params.settings.dmPolicy : params.settings.groupPolicy

  if (policy === 'disabled') {
    return {
      notice: isDm ? '当前机器人已关闭私信，请在群内 @ 机器人。' : '当前机器人已关闭群聊回复。',
      ok: false,
      reason: 'disabled',
    }
  }

  if (policy === 'allowlist') {
    if (!authorId || !isAllowlisted(params.settings, authorId)) {
      return { notice: '你无权向该机器人发送消息。', ok: false, reason: 'allowlist' }
    }
    return { ok: true }
  }

  return { ok: true }
}

/**
 * 按绑定 `charLimit`（且不超过平台硬上限）分片出站文本，对齐微信多条发送语义。
 * 短文本返回单元素数组。实现复用 `@pure/chat-adapter/qq` 的 surrogate-safe 分片。
 */
export function chunkQQOutboundText(text: string, charLimit: number): string[] {
  const limit = Math.min(QQ_PLATFORM_MAX_TEXT_LENGTH, Math.max(QQ_MIN_CHAR_LIMIT, Math.round(charLimit)))
  return chunkQQText(text, limit)
}
