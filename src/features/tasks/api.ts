import type { TaskDTO, TaskInput, TaskRunDTO, TaskRuntimeDTO, TaskStatus } from '@pure/types'
import { apiFetch, jsonInit } from '@/utils/apiFetch'

export async function taskRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init)
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || '任务请求失败，请稍后重试')
  return data as T
}

export const createScheduledTask = (input: TaskInput) =>
  taskRequest<TaskDTO>('/api/tasks', jsonInit(input, { method: 'POST' }))
export const patchTask = (id: string, input: Partial<TaskInput> & { status?: TaskStatus }) =>
  taskRequest<TaskDTO>(`/api/tasks/${encodeURIComponent(id)}`, jsonInit(input, { method: 'PATCH' }))
export const runTask = (id: string) =>
  taskRequest<TaskRunDTO>(
    `/api/tasks/${encodeURIComponent(id)}/run`,
    jsonInit({ requestId: crypto.randomUUID() }, { method: 'POST' })
  )
export const stopRun = (taskId: string, runId: string) =>
  taskRequest<TaskRunDTO>(`/api/tasks/${encodeURIComponent(taskId)}/runs/${encodeURIComponent(runId)}/stop`, {
    method: 'POST',
  })
export const deleteTaskRun = (taskId: string, runId: string) =>
  taskRequest<{ ok: boolean }>(
    `/api/tasks/${encodeURIComponent(taskId)}/runs/${encodeURIComponent(runId)}`,
    { method: 'DELETE' }
  )
export const resendTaskDelivery = (taskId: string, deliveryId: string) =>
  taskRequest<{ ok: boolean }>(
    `/api/tasks/${encodeURIComponent(taskId)}/deliveries/${encodeURIComponent(deliveryId)}/retry`,
    { method: 'POST' }
  )

export type { TaskRuntimeDTO }
