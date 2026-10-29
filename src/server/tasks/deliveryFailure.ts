import { QQActiveMessageError } from '@pure/chat-adapter/qq'
import type { TaskChannel, TaskDeliveryStatus } from '@pure/types'

import { TaskServiceError } from './errors'

export function taskDeliveryFailure(
  error: unknown,
  platform: TaskChannel
): { error: string; status: TaskDeliveryStatus } {
  if (error instanceof TaskServiceError) return { error: error.message, status: 'action_required' }

  const details = error as { code?: number; statusCode?: number }
  if (platform === 'qq') {
    if (error instanceof QQActiveMessageError) {
      if (error.kind === 'unknown') return { error: error.message, status: 'unknown' }
      if (error.kind === 'not_sent') {
        return error.statusCode
          ? { error: error.message, status: 'action_required' }
          : { error: 'QQ 鉴权服务暂时不可用，稍后重试', status: 'retry' }
      }
      if (error.code === 40034100 || error.code === 40054016 || error.statusCode === 429) {
        return { error: 'QQ 消息触发频率限制或机器人暂时离线，稍后重试', status: 'retry' }
      }
      if ((error.statusCode ?? 0) >= 500) return { error: error.message, status: 'unknown' }
      if (error.code === 40034105) {
        return { error: 'QQ 机器人没有 C2C 主动消息权限，请检查开放平台配置', status: 'action_required' }
      }
      if (error.code === 40054004) {
        return { error: 'QQ 用户尚未与机器人建立可主动发送的会话关系', status: 'action_required' }
      }
      if (error.code === 40054013) {
        return { error: 'QQ 用户已拒收机器人消息', status: 'action_required' }
      }
      return { error: 'QQ 拒绝主动推送，请检查用户关系和开放平台权限', status: 'action_required' }
    }
    return { error: 'QQ 请求结果不确定，请核实是否收到后再重发', status: 'unknown' }
  }

  if (details?.statusCode === 429 || (details?.statusCode ?? 0) >= 500) {
    return { error: '微信服务暂时不可用，稍后重试', status: 'retry' }
  }
  if (typeof details?.code === 'number' || typeof details?.statusCode === 'number') {
    return { error: '微信拒绝推送，请重新绑定或给机器人再发一条消息后重试', status: 'action_required' }
  }
  return { error: '微信请求结果不确定，请核实是否收到后再重发', status: 'unknown' }
}
