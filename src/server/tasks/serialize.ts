import type { TaskDTO, TaskDeliveryDTO, TaskRunDTO } from '@pure/types'
import type { TaskDeliveryItem, TaskItem, TaskRunItem } from '@pure/database/schemas/task'
import { taskSnapshot } from '@pure/database/models/task'

export function taskDeliveryDTO(row: TaskDeliveryItem): TaskDeliveryDTO {
  return {
    attempts: row.attempts,
    completedAt: row.completedAt?.toISOString() ?? null,
    error: row.error,
    id: row.id,
    platform: row.platform,
    status: row.status,
  }
}

export function taskRunDTO(row: TaskRunItem, deliveries: TaskDeliveryItem[] = []): TaskRunDTO {
  return {
    attempts: row.attempts,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    deliveries: deliveries.map(taskDeliveryDTO),
    diagnostics: row.diagnostics,
    error: row.error,
    id: row.id,
    result: row.result,
    scheduledAt: row.scheduledAt.toISOString(),
    snapshot: row.snapshot,
    source: row.source,
    startedAt: row.startedAt?.toISOString() ?? null,
    status: row.status,
    taskId: row.taskId,
  }
}

export function taskDTO(
  row: TaskItem,
  latestRun: TaskRunDTO | null = null,
  activeRun: TaskRunDTO | null = null
): TaskDTO {
  return {
    ...taskSnapshot(row),
    activeRun,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    latestRun,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  }
}
