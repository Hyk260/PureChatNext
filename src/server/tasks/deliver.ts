import { MessageItemType, WechatApiClient } from '@pure/chat-adapter/wechat'
import { QQApiClient } from '@pure/chat-adapter/qq'
import type { TaskDeliveryItem, TaskRunItem } from '@pure/database/schemas/task'

import { appEnv } from '@/envs/app'
import { decryptCredentials as decryptQQCredentials } from '@/libs/channels/qq/encrypt'
import { decryptContextToken, decryptCredentials as decryptWechatCredentials } from '@/libs/channels/wechat/encrypt'
import { TaskServiceError } from './errors'
import { taskNotification } from './notification'
import { resolveTaskTarget } from './targets'

export { taskDeliveryFailure } from './deliveryFailure'

export async function deliverTask(run: TaskRunItem, delivery: TaskDeliveryItem, signal: AbortSignal) {
  const target = await resolveTaskTarget(run.userId, delivery.platform)
  const text = taskNotification({ ...run, appUrl: appEnv.APP_URL })
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(60_000)])
  if (target.platform === 'qq') {
    let credentials: ReturnType<typeof decryptQQCredentials>
    try {
      credentials = decryptQQCredentials(target.binding.credentials)
    } catch {
      throw new TaskServiceError('QQ 网关凭据无法解密，请重新连接 QQ')
    }
    await new QQApiClient(credentials.appId, credentials.appSecret).sendC2CActiveMessage(
      target.recipient,
      text,
      AbortSignal.any([requestSignal, AbortSignal.timeout(15_000)])
    )
    return
  }

  let credentials: ReturnType<typeof decryptWechatCredentials>
  let contextToken: string
  try {
    credentials = decryptWechatCredentials(target.binding.credentials)
    contextToken = decryptContextToken(target.contextToken)
  } catch {
    throw new TaskServiceError('微信会话凭据不可用，请重新绑定并给机器人发一条消息')
  }
  await new WechatApiClient(credentials.botToken, credentials.botId).sendItem(
    target.recipient,
    { type: MessageItemType.TEXT, text_item: { text } },
    contextToken,
    { clientId: delivery.id, signal: AbortSignal.any([requestSignal, AbortSignal.timeout(15_000)]) }
  )
}
