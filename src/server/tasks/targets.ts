import { and, desc, eq, ne } from 'drizzle-orm'
import type { TaskChannel, TaskChannelAvailability } from '@pure/types'
import { getServerDB } from '@pure/database/core/db-adaptor'
import { ChannelBindingModel } from '@pure/database/models/channelBinding'
import { channelEvents, channelSessions } from '@pure/database/schemas/channel'
import type { ChannelBindingItem } from '@pure/database/schemas/channel'

import { appEnv } from '@/envs/app'
import { normalizeQQChannelSettings } from '@/libs/channels/qq/advancedSettings'
import { decryptCredentials as decryptWechatCredentials } from '@/libs/channels/wechat/encrypt'
import { TaskServiceError } from './errors'
import { validateTaskNotificationUrl } from './notification'

type WechatTaskTarget = { binding: ChannelBindingItem; contextToken: string; platform: 'wechat'; recipient: string }
type QQTaskTarget = { binding: ChannelBindingItem; platform: 'qq'; recipient: string }
export type TaskTarget = QQTaskTarget | WechatTaskTarget

export async function resolveTaskTarget(userId: string, platform: TaskChannel): Promise<TaskTarget> {
  const binding = await new ChannelBindingModel().findByUserAndPlatform(userId, platform)
  const channelName = platform === 'qq' ? 'QQ' : '微信'
  if (!binding || !binding.enabled || binding.needsRebind) {
    throw new TaskServiceError(`请先连接可用的${channelName}网关`)
  }

  if (platform === 'qq') {
    const recipient = normalizeQQChannelSettings(binding.settings).platformUserId
    if (!recipient) {
      throw new TaskServiceError('QQ 网关缺少本人 user_openid，请前往 QQ 高级设置完成配置')
    }
    return { binding, platform, recipient }
  }

  const db = getServerDB()
  let owner: string
  try {
    owner = decryptWechatCredentials(binding.credentials).userId
  } catch {
    throw new TaskServiceError('微信网关凭据无法解密，请重新绑定微信')
  }
  const [event] = await db
    .select({ token: channelEvents.encryptedContextToken })
    .from(channelEvents)
    .innerJoin(channelSessions, eq(channelSessions.id, channelEvents.sessionId))
    .where(
      and(
        eq(channelEvents.bindingId, binding.id),
        eq(channelSessions.externalUserId, owner),
        ne(channelEvents.messageKind, 'outbound'),
        ne(channelEvents.encryptedContextToken, '')
      )
    )
    .orderBy(desc(channelEvents.createdAt))
    .limit(1)
  if (!event) throw new TaskServiceError('微信缺少本人会话凭据，请先给机器人发送一条消息')
  return { binding, contextToken: event.token, platform, recipient: owner }
}

export async function taskChannelAvailability(userId: string): Promise<TaskChannelAvailability[]> {
  const platforms: TaskChannel[] = ['qq', 'wechat']
  let notificationError: string | null = null
  try {
    validateTaskNotificationUrl(appEnv.APP_URL)
  } catch (error) {
    notificationError = error instanceof TaskServiceError ? error.message : '请检查 APP_URL 配置'
  }
  return Promise.all(
    platforms.map(async (platform) => {
      if (notificationError) return { available: false, platform, reason: notificationError }
      try {
        await resolveTaskTarget(userId, platform)
        return { available: true, platform, reason: null }
      } catch (error) {
        const reason = error instanceof TaskServiceError ? error.message : '渠道配置不可用，请检查网关设置'
        return { available: false, platform, reason }
      }
    })
  )
}
