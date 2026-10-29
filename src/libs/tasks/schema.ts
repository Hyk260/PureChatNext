import { z } from 'zod'
import type { TaskInput } from '@pure/types'
import { TASK_STATUSES } from '@pure/types'
import { isTaskTimezone } from '@pure/utils/taskSchedule'

const minute = z.number().int().min(0).max(59)
const hour = z.number().int().min(0).max(23)
const timezone = z.string().refine(isTaskTimezone, '请选择有效的时区')

export const taskScheduleSchema = z.discriminatedUnion('frequency', [
  z.object({ frequency: z.literal('daily'), hour, minute, timezone }).strict(),
  z.object({ frequency: z.literal('hourly'), minute, timezone }).strict(),
  z
    .object({
      frequency: z.literal('weekly'),
      hour,
      minute,
      timezone,
      weekdays: z
        .array(z.number().int().min(0).max(6))
        .min(1, '至少选择一个星期')
        .max(7)
        .transform((days) => [...new Set(days)].sort()),
    })
    .strict(),
])

export const taskInputSchema = z
  .object({
    agentId: z.string().trim().min(1, '请选择执行助理').max(128),
    channels: z
      .array(z.enum(['qq', 'wechat']))
      .max(2)
      .transform((values) => [...new Set(values)]),
    enabled: z.boolean(),
    instruction: z.string().trim().max(20_000, '执行说明不能超过20000字'),
    model: z.string().trim().min(1, '请选择执行模型').max(255),
    priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    provider: z.string().trim().min(1, '请选择模型服务商').max(128),
    schedule: taskScheduleSchema,
    title: z.string().trim().min(1, '请输入任务标题').max(200, '任务标题不能超过200字'),
  })
  .strict()

export const taskPatchSchema = taskInputSchema
  .partial()
  .extend({ status: z.enum(TASK_STATUSES).optional() })
  .strict()
export const taskRequestIdSchema = z.object({ requestId: z.string().min(8).max(128) }).strict()

export function normalizeTaskInput(input: TaskInput): TaskInput {
  return { ...input, instruction: input.instruction || input.title }
}
