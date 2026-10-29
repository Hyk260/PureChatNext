import { describe, expect, it } from 'vitest'
import type { TaskSchedule } from '@pure/types'

import { nextTaskRun, taskCronPattern, taskFiring, TASK_MISFIRE_GRACE_MS } from './taskSchedule'

const daily: TaskSchedule = { frequency: 'daily', hour: 8, minute: 30, timezone: 'Asia/Shanghai' }

describe('scheduled task calendar', () => {
  it('computes Shanghai 08:30 and advances an exact boundary to tomorrow', () => {
    expect(nextTaskRun(daily, new Date('2026-10-28T00:00:00Z')).toISOString()).toBe('2026-10-28T00:30:00.000Z')
    expect(nextTaskRun(daily, new Date('2026-10-28T00:30:00Z')).toISOString()).toBe('2026-10-29T00:30:00.000Z')
  })

  it('supports arbitrary hourly minutes across midnight and selected weekdays', () => {
    expect(
      nextTaskRun({ frequency: 'hourly', minute: 17, timezone: 'UTC' }, new Date('2026-10-28T23:58:00Z')).toISOString()
    ).toBe('2026-10-29T00:17:00.000Z')
    expect(
      nextTaskRun(
        { frequency: 'weekly', weekdays: [1, 5], hour: 9, minute: 0, timezone: 'Asia/Shanghai' },
        new Date('2026-10-28T00:00:00Z')
      ).toISOString()
    ).toBe('2026-10-30T01:00:00.000Z')
  })

  it('keeps local wall-clock time through spring and autumn DST transitions', () => {
    const schedule: TaskSchedule = { frequency: 'daily', hour: 9, minute: 0, timezone: 'America/New_York' }
    expect(nextTaskRun(schedule, new Date('2026-03-07T15:00:00Z')).toISOString()).toBe('2026-03-08T13:00:00.000Z')
    expect(nextTaskRun(schedule, new Date('2026-10-31T15:00:00Z')).toISOString()).toBe('2026-11-01T14:00:00.000Z')
  })

  it('only catches up the latest occurrence within fifteen minutes', () => {
    const now = new Date('2026-10-28T00:35:00Z')
    const firing = taskFiring(daily, new Date('2026-10-20T00:30:00Z'), now)!
    expect(firing.scheduledAt.toISOString()).toBe('2026-10-28T00:30:00.000Z')
    expect(firing.missedFrom?.toISOString()).toBe('2026-10-20T00:30:00.000Z')
    expect(firing.skipped).toBe(false)
    const due = firing.scheduledAt
    expect(taskFiring(daily, due, new Date(due.getTime() + TASK_MISFIRE_GRACE_MS))?.skipped).toBe(false)
    expect(taskFiring(daily, due, new Date(due.getTime() + TASK_MISFIRE_GRACE_MS + 1))?.skipped).toBe(true)
    expect(taskFiring(daily, new Date('2026-10-29T00:30:00Z'), now)).toBeNull()
  })

  it('rejects invalid timezones, minutes and empty weekly selections', () => {
    expect(() => taskCronPattern({ ...daily, timezone: 'Asia/Unknown' })).toThrow('时区')
    expect(() => taskCronPattern({ ...daily, minute: 60 })).toThrow('分钟')
    expect(() => taskCronPattern({ frequency: 'weekly', hour: 9, minute: 0, weekdays: [], timezone: 'UTC' })).toThrow(
      '星期'
    )
  })
})
