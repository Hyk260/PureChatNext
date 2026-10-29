import { CronExpressionParser } from 'cron-parser'
import type { TaskSchedule } from '@pure/types'

export const TASK_MISFIRE_GRACE_MS = 15 * 60_000
export const DEFAULT_TASK_SCHEDULE: TaskSchedule = {
  frequency: 'daily',
  hour: 9,
  minute: 0,
  timezone: 'Asia/Shanghai',
}

export function isTaskTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export function taskCronPattern(schedule: TaskSchedule): string {
  if (!isTaskTimezone(schedule.timezone)) throw new Error('无效的时区')
  if (!Number.isInteger(schedule.minute) || schedule.minute < 0 || schedule.minute > 59) {
    throw new Error('分钟应为 0 到 59')
  }
  if (schedule.frequency === 'hourly') return `${schedule.minute} * * * *`
  if (!Number.isInteger(schedule.hour) || schedule.hour < 0 || schedule.hour > 23) {
    throw new Error('小时应为 0 到 23')
  }
  if (schedule.frequency === 'daily') return `${schedule.minute} ${schedule.hour} * * *`
  if (!schedule.weekdays.length || schedule.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new Error('至少选择一个有效的星期')
  }
  const days = [...new Set(schedule.weekdays)].sort().join(',')
  return `${schedule.minute} ${schedule.hour} * * ${days}`
}

export function nextTaskRun(schedule: TaskSchedule, after = new Date()): Date {
  return CronExpressionParser.parse(taskCronPattern(schedule), {
    currentDate: after,
    tz: schedule.timezone,
  })
    .next()
    .toDate()
}

/** 停机后聚合较早的排期，仅考虑最近一次是否仍在补跑窗口中。 */
export function taskFiring(schedule: TaskSchedule, dueAt: Date, now: Date) {
  if (dueAt > now) return null
  const latest = CronExpressionParser.parse(taskCronPattern(schedule), {
    currentDate: new Date(now.getTime() + 1),
    tz: schedule.timezone,
  })
    .prev()
    .toDate()
  const scheduledAt = latest < dueAt ? dueAt : latest
  return {
    missedFrom: scheduledAt > dueAt ? dueAt : null,
    nextRunAt: nextTaskRun(schedule, now),
    scheduledAt,
    skipped: now.getTime() - scheduledAt.getTime() > TASK_MISFIRE_GRACE_MS,
  }
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const pad = (value: number) => String(value).padStart(2, '0')

export function formatTaskSchedule(schedule: TaskSchedule): string {
  if (schedule.frequency === 'hourly') return `每小时 :${pad(schedule.minute)} 运行`
  const time = `${pad(schedule.hour)}:${pad(schedule.minute)}`
  if (schedule.frequency === 'daily') return `每天 ${time} 运行`
  const days = [...schedule.weekdays].sort((a, b) => (a || 7) - (b || 7))
  return `每周 ${days.map((day) => WEEKDAY_LABELS[day]).join('、')} ${time} 运行`
}
