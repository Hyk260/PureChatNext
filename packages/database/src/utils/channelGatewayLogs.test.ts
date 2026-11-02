import { describe, expect, it } from 'vitest'

import { CHANNEL_LOG_MAX_BYTES } from '@pure/types'
import { channelErrorCode, formatChannelGatewayLogs, normalizeChannelLog } from './channelGatewayLogs'

describe('channel diagnostics formatting', () => {
  it('ignores invalid retry numbers and keeps rounding and bounds for finite values', () => {
    const retry = { userId: 'owner', platform: 'qq', event: 'retry' } as const
    const baseMessage = normalizeChannelLog(retry).message
    for (const value of [NaN, Infinity, -Infinity, '2', null, undefined]) {
      expect(normalizeChannelLog({ ...retry, attempt: value as never, delayMs: value as never }).message)
        .toBe(baseMessage)
    }
    expect(normalizeChannelLog({ ...retry, attempt: 2.9, delayMs: 10.9 }).message)
      .toBe(`${baseMessage}，第 2 次，10ms 后执行`)
    expect(normalizeChannelLog({ ...retry, attempt: 0, delayMs: -1 }).message)
      .toBe(`${baseMessage}，第 1 次，0ms 后执行`)
    expect(normalizeChannelLog({ ...retry, attempt: 1e6, delayMs: 1e6 }).message)
      .toBe(`${baseMessage}，第 9999 次，300000ms 后执行`)
  })

  it('drops credentials, arbitrary codes and raw error objects', () => {
    const secret = 'secret-token-qr-body'
    expect(channelErrorCode({ code: secret, name: secret, message: secret, stack: secret })).toBe('Error')
    expect(channelErrorCode({ code: 'ECONNRESET', message: secret })).toBe('ECONNRESET')
    expect(channelErrorCode({ code: 40034128 })).toBe('40034128')
    expect(channelErrorCode({ code: 'QQ_850018' })).toBe('850018')
    expect(channelErrorCode({ code: 'SPEECH_SYNTHESIS_FAILED' })).toBe('SPEECH_SYNTHESIS_FAILED')
    expect(channelErrorCode({ code: 'SPEECH_HTTP_400' })).toBe('SPEECH_HTTP_400')
    expect(channelErrorCode({ code: 'SPEECH_HTTP_200' })).toBe('Error')
    const row = normalizeChannelLog({ userId: 'owner', platform: 'qq', event: 'send_failed', code: secret })
    expect(row).toEqual({ level: 'error', message: '回复发送失败', code: null })
    expect(JSON.stringify(row)).not.toContain(secret)
  })

  it('orders newest retained complete lines chronologically and bounds the JSON response in UTF-8', () => {
    const row = { event: 'offline' as const, level: 'warn', code: null }
    const result = formatChannelGatewayLogs([
      { ...row, createdAt: new Date(2000), message: '新日志' },
      { ...row, createdAt: new Date(1000), message: '旧日志' },
    ])
    expect(result.text.indexOf('旧日志')).toBeLessThan(result.text.indexOf('新日志'))
    expect(result.truncated).toBe(false)
    const huge = formatChannelGatewayLogs([
      { ...row, createdAt: new Date(2000), message: '中\\"'.repeat(30000) },
      { ...row, createdAt: new Date(1000), message: '中'.repeat(100000) },
    ])
    expect(Buffer.byteLength(JSON.stringify(huge))).toBeLessThanOrEqual(CHANNEL_LOG_MAX_BYTES)
    expect(huge.truncated).toBe(true)
    expect(huge.text).toContain('1970-01-01T00:00:02')
    expect(huge.text).not.toContain('1970-01-01T00:00:01')
  })
})
