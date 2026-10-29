import { describe, expect, it } from 'vitest'
import type { TaskRunSnapshot } from '@pure/types'

import { taskNotification, validateTaskNotificationUrl } from './notification'

const snapshot: TaskRunSnapshot = {
  agentId: 'agent',
  channels: ['qq'],
  enabled: true,
  instruction: '提醒喝水',
  model: 'model',
  priority: 0,
  provider: 'openai',
  schedule: { frequency: 'daily', hour: 8, minute: 30, timezone: 'Asia/Shanghai' },
  title: '喝水提醒',
}

describe('task notifications', () => {
  const run = {
    appUrl: 'https://example.com',
    error: null,
    id: 'run-1',
    result: '喝杯水吧',
    snapshot,
    status: 'succeeded',
    taskId: 'task-1',
  }
  it('includes the result and authenticated run deep link', () => {
    expect(taskNotification(run)).toBe(
      '任务已完成：喝水提醒\n\n喝杯水吧\n\n查看详情：https://example.com/tasks/task-1?run=run-1'
    )
  })
  it('clips Unicode points without splitting emojis and does not expose URL credentials', () => {
    const text = taskNotification({
      ...run,
      appUrl: 'https://user:secret@example.com/?token=private',
      result: '💧'.repeat(1005),
    })
    expect(text.match(/💧/gu)).toHaveLength(1000)
    expect(text).toContain('…')
    expect(text).not.toMatch(/secret|private/)
  })
  it('sends final failure summaries and rejects invalid application URLs', () => {
    expect(taskNotification({ ...run, result: null, error: '模型暂时不可用', status: 'failed' })).toContain(
      '任务执行失败：喝水提醒'
    )
    expect(() => taskNotification({ ...run, appUrl: undefined })).toThrow('APP_URL')
    expect(() => taskNotification({ ...run, appUrl: 'javascript:alert(1)' })).toThrow('APP_URL')
  })
  it('validates notification origins before task creation', () => {
    expect(validateTaskNotificationUrl('https://example.com/path').origin).toBe('https://example.com')
    expect(() => validateTaskNotificationUrl('javascript:alert(1)')).toThrow('APP_URL')
  })
})
