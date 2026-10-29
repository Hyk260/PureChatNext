import type { TaskRunSnapshot } from '@pure/types'
import { TaskServiceError } from './errors'

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

export function validateTaskNotificationUrl(appUrl?: string): URL {
  try {
    const base = new URL(appUrl ?? '')
    if (!ALLOWED_PROTOCOLS.has(base.protocol) || base.origin.length > 500) throw new Error('invalid URL')
    return base
  } catch {
    throw new TaskServiceError('请先配置正确的 APP_URL，以便通知提供任务详情链接')
  }
}

export function taskNotification(input: {
  appUrl?: string
  error: string | null
  id: string
  result: string | null
  snapshot: TaskRunSnapshot
  status: string
  taskId: string
}) {
  const base = validateTaskNotificationUrl(input.appUrl)
  const success = input.status === 'succeeded'
  const content = input.result || input.error || '任务没有返回结果'
  const points = [...content]
  const excerpt = points.slice(0, 1000).join('') + (points.length > 1000 ? '…' : '')
  const link = `${base.origin}/tasks/${encodeURIComponent(input.taskId)}?run=${encodeURIComponent(input.id)}`
  return `${success ? '任务已完成' : '任务执行失败'}：${input.snapshot.title}\n\n${excerpt}\n\n查看详情：${link}`
}
