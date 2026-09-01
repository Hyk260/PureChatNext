import { describe, expect, it } from 'vitest'

import { getToolApprovalTitle } from '@/features/chat/localTools'

describe('getToolApprovalTitle', () => {
  it('returns a Chinese permission question for local tools', () => {
    expect(getToolApprovalTitle('getSystemInfo')).toBe('允许读取系统信息？')
    expect(getToolApprovalTitle('runCommand')).toBe('允许运行这条命令？')
    expect(getToolApprovalTitle('readFile')).toBe('允许读取文件？')
  })

  it('returns a Chinese question for known server tools', () => {
    expect(getToolApprovalTitle('webSearch')).toBe('允许联网搜索？')
    expect(getToolApprovalTitle('getWeather')).toBe('允许查询天气？')
  })

  it('falls back to a generic question for unknown tools', () => {
    expect(getToolApprovalTitle('customMcpTool')).toBe('允许执行此操作？')
  })
})
