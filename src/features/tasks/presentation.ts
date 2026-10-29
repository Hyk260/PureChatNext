import { cssVar } from '@lobehub/ui'
import { Ban, CircleCheck, CircleDashed, Hand } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import type { TaskChannel, TaskDeliveryStatus, TaskPriority, TaskRunStatus, TaskStatus } from '@pure/types'

import {
  PriorityHighIcon,
  PriorityLowIcon,
  PriorityMediumIcon,
  PriorityNoneIcon,
  PriorityUrgentIcon,
} from './priorityIcons'

type TaskIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

type TaskMenuOption = {
  label: string
  icon: TaskIcon
  className?: string
  color?: string
}

export const TASK_CHANNEL_LABELS: Record<TaskChannel, string> = { qq: 'QQ', wechat: '微信' }

export const TASK_STATUS_META: Record<TaskStatus, TaskMenuOption> = {
  todo: { label: '待办', icon: CircleDashed, className: 'text-muted-foreground' },
  review: { label: '待审阅', icon: Hand, color: cssVar.colorInfo },
  completed: { label: '已完成', icon: CircleCheck, color: cssVar.colorSuccess },
  canceled: { label: '已取消', icon: Ban, className: 'text-muted-foreground' },
}

export const TASK_PRIORITY_OPTIONS: Array<TaskMenuOption & { value: TaskPriority }> = [
  { value: 0, label: '无优先级', icon: PriorityNoneIcon, className: 'text-muted-foreground' },
  { value: 1, label: '紧急', icon: PriorityUrgentIcon, color: cssVar.colorWarning },
  { value: 2, label: '高', icon: PriorityHighIcon, className: 'text-muted-foreground' },
  { value: 3, label: '普通', icon: PriorityMediumIcon, className: 'text-muted-foreground' },
  { value: 4, label: '低', icon: PriorityLowIcon, className: 'text-muted-foreground' },
]

export const RUN_LABELS: Record<TaskRunStatus, string> = {
  pending: '排队中',
  running: '运行中',
  retry: '等待重试',
  succeeded: '执行成功',
  failed: '执行失败',
  canceled: '已停止',
  skipped: '已跳过',
}
export const DELIVERY_LABELS: Record<TaskDeliveryStatus, string> = {
  pending: '等待推送',
  sending: '推送中',
  retry: '等待重试',
  accepted: '平台已接受',
  failed: '推送失败',
  action_required: '需要处理',
  unknown: '待确认',
}
export const OPEN_RUN_STATUSES = new Set<TaskRunStatus>(['pending', 'running', 'retry'])
export const TASK_COLLECTIONS = [
  { value: 'manual', label: '任务' },
  { value: 'scheduled', label: '定时任务' },
]
export const STATUS_FILTERS = [
  { value: 'all', label: '全部状态' },
  ...Object.entries(TASK_STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
]
export const PRIORITY_FILTERS = [
  { value: 'all', label: '全部优先级' },
  ...TASK_PRIORITY_OPTIONS.map((item) => ({ value: String(item.value), label: item.label })),
]

export function formatTaskDate(value: string | null, timezone = 'Asia/Shanghai') {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}
