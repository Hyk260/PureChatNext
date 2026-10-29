export const TASK_STATUSES = ['todo', 'review', 'completed', 'canceled'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]
export type TaskPriority = 0 | 1 | 2 | 3 | 4
export type TaskChannel = 'qq' | 'wechat'

type ScheduleBase = { minute: number; timezone: string }
export type TaskSchedule = ScheduleBase &
  (
    | { frequency: 'daily'; hour: number }
    | { frequency: 'hourly' }
    | { frequency: 'weekly'; hour: number; weekdays: number[] }
  )

export type TaskInput = {
  agentId: string
  channels: TaskChannel[]
  enabled: boolean
  instruction: string
  model: string
  priority: TaskPriority
  provider: string
  schedule: TaskSchedule
  title: string
}

export type TaskRunStatus = 'pending' | 'running' | 'retry' | 'succeeded' | 'failed' | 'canceled' | 'skipped'
export type TaskDeliveryStatus = 'pending' | 'sending' | 'retry' | 'accepted' | 'failed' | 'action_required' | 'unknown'

export type TaskRunSnapshot = TaskInput & {
  agentTitle?: string
  systemRole?: string
}

export type TaskDeliveryDTO = {
  attempts: number
  completedAt: string | null
  error: string | null
  id: string
  platform: TaskChannel
  status: TaskDeliveryStatus
}

export type TaskRunDTO = {
  attempts: number
  completedAt: string | null
  createdAt: string
  deliveries: TaskDeliveryDTO[]
  diagnostics: Record<string, unknown> | null
  error: string | null
  id: string
  result: string | null
  scheduledAt: string
  snapshot: TaskRunSnapshot
  source: 'manual' | 'schedule'
  startedAt: string | null
  status: TaskRunStatus
  taskId: string
}

export type TaskDTO = TaskInput & {
  activeRun: TaskRunDTO | null
  createdAt: string
  id: string
  latestRun: TaskRunDTO | null
  nextRunAt: string | null
  status: TaskStatus
  updatedAt: string
}

export type TaskChannelAvailability = {
  available: boolean
  platform: TaskChannel
  reason: string | null
}

export type TaskRuntimeDTO = {
  channels: TaskChannelAvailability[]
  enabled: boolean
  healthy: boolean
  lastHeartbeatAt: string | null
  reason: string | null
}
