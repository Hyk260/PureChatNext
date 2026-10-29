import type { TaskInput, TaskRuntimeDTO, TaskStatus } from '@pure/types'
import { OPEN_TASK_RUN_STATUSES, TaskModel, taskSnapshot } from '@pure/database/models/task'
import { taskEnv } from '@/envs/tasks'
import { IS_VERCEL } from '@/envs/app'
import { normalizeTaskInput } from '@/libs/tasks/schema'

import { TaskServiceError } from './errors'
import { abortTaskRun, ensureTaskSchedulerRunning } from './manager'
import { validateTaskResources } from './resources'
import { taskChannelAvailability } from './targets'
import { taskDTO, taskRunDTO } from './serialize'

function requireScheduler() {
  if (!taskEnv.TASK_SCHEDULER_ENABLED)
    throw new TaskServiceError(
      IS_VERCEL ? 'Vercel 部署暂不支持定时任务，请使用自部署服务' : '当前服务器未启用 TASK_SCHEDULER_ENABLED',
      409
    )
  ensureTaskSchedulerRunning()
}

export async function listTasks(userId: string) {
  const model = new TaskModel()
  const tasks = await model.list(userId)
  const runs = await model.latestRuns(
    userId,
    tasks.map((task) => task.id)
  )
  const activeRuns = await model.activeRuns(
    userId,
    tasks.map((task) => task.id)
  )
  const deliveries = await model.deliveries(
    userId,
    runs.map((run) => run.id)
  )
  const latest = new Map(
    runs.map((run) => [
      run.taskId,
      taskRunDTO(
        run,
        deliveries.filter((item) => item.runId === run.id)
      ),
    ])
  )
  const active = new Map(activeRuns.map((run) => [run.taskId, taskRunDTO(run)]))
  return tasks.map((task) => taskDTO(task, latest.get(task.id) ?? null, active.get(task.id) ?? null))
}

export async function getTask(userId: string, id: string) {
  const model = new TaskModel()
  const task = await model.find(userId, id)
  if (!task) throw new TaskServiceError('任务不存在', 404)
  const [run] = await model.latestRuns(userId, [id])
  const [active] = await model.activeRuns(userId, [id])
  const deliveries = run ? await model.deliveries(userId, [run.id]) : []
  return taskDTO(task, run ? taskRunDTO(run, deliveries) : null, active ? taskRunDTO(active) : null)
}

export async function createTask(userId: string, input: TaskInput) {
  requireScheduler()
  const normalized = normalizeTaskInput(input)
  await validateTaskResources(userId, normalized)
  return taskDTO(await new TaskModel().create(userId, normalized))
}

export async function updateTask(userId: string, id: string, patch: Partial<TaskInput> & { status?: TaskStatus }) {
  const model = new TaskModel()
  const existing = await model.find(userId, id)
  if (!existing) throw new TaskServiceError('任务不存在', 404)
  const input = normalizeTaskInput({ ...taskSnapshot(existing), ...patch })
  const status = patch.status ?? existing.status
  const terminal = status === 'completed' || status === 'canceled'
  const changingConfiguration = Object.keys(patch).some((key) => key !== 'enabled' && key !== 'status')
  const needsValidation = !terminal && input.enabled && (!existing.enabled || changingConfiguration)
  if (needsValidation) {
    requireScheduler()
    await validateTaskResources(userId, input)
  }
  const updated = await model.update(userId, id, input, patch.status)
  if (!updated) throw new TaskServiceError('任务不存在', 404)
  return getTask(userId, id)
}

export async function runTaskNow(userId: string, id: string, requestId: string) {
  requireScheduler()
  const run = await new TaskModel().enqueueManual(userId, id, requestId)
  if (!run) throw new TaskServiceError('任务不存在', 404)
  return taskRunDTO(run)
}

export async function getTaskRuns(userId: string, id: string, before?: string) {
  const model = new TaskModel()
  if (!(await model.find(userId, id))) throw new TaskServiceError('任务不存在', 404)
  const runs = await model.runs(userId, id, 50, before)
  const deliveries = await model.deliveries(
    userId,
    runs.map((run) => run.id)
  )
  return runs.map((run) =>
    taskRunDTO(
      run,
      deliveries.filter((item) => item.runId === run.id)
    )
  )
}

export async function getTaskRun(userId: string, taskId: string, runId: string) {
  const model = new TaskModel()
  const run = await model.findRun(userId, taskId, runId)
  if (!run) throw new TaskServiceError('运行记录不存在', 404)
  return taskRunDTO(run, await model.deliveries(userId, [runId]))
}

export async function stopTaskRun(userId: string, taskId: string, runId: string) {
  const stopped = await new TaskModel().stopRun(userId, taskId, runId)
  if (!stopped) throw new TaskServiceError('该运行不存在或已经结束', 409)
  abortTaskRun(runId)
  return taskRunDTO(stopped)
}

export async function deleteTaskRun(userId: string, taskId: string, runId: string) {
  const model = new TaskModel()
  const run = await model.findRun(userId, taskId, runId)
  if (!run) throw new TaskServiceError('运行记录不存在', 404)
  if (OPEN_TASK_RUN_STATUSES.includes(run.status as (typeof OPEN_TASK_RUN_STATUSES)[number]))
    throw new TaskServiceError('运行中的记录不能删除，请先停止运行', 409)
  if (!(await model.deleteRun(userId, taskId, runId)))
    throw new TaskServiceError('运行记录状态已变化，请刷新后重试', 409)
  return { ok: true }
}

export async function retryTaskDelivery(userId: string, taskId: string, deliveryId: string) {
  requireScheduler()
  const model = new TaskModel()
  const platform = await model.findDeliveryPlatform(userId, taskId, deliveryId)
  if (!platform) throw new TaskServiceError('投递记录不存在', 404)
  const delivery = await model.retryDelivery(userId, taskId, deliveryId)
  if (!delivery) throw new TaskServiceError('投递记录不存在', 404)
  return { ok: true }
}

export async function taskRuntime(userId: string): Promise<TaskRuntimeDTO> {
  ensureTaskSchedulerRunning()
  const [state, channels] = await Promise.all([new TaskModel().schedulerState(), taskChannelAvailability(userId)])
  const enabled = taskEnv.TASK_SCHEDULER_ENABLED
  const healthy =
    enabled && Boolean(state && state.leaseExpiresAt > new Date() && Date.now() - state.heartbeatAt.getTime() < 45_000)
  let reason: string | null = null
  if (!enabled)
    reason = IS_VERCEL ? 'Vercel 暂不支持云端定时任务' : '服务器未启用定时任务，请设置 TASK_SCHEDULER_ENABLED=1'
  else if (!healthy) reason = '调度器正在启动或暂时不可用，请检查服务器和数据库连接'
  return { channels, enabled, healthy, lastHeartbeatAt: state?.heartbeatAt.toISOString() ?? null, reason }
}
