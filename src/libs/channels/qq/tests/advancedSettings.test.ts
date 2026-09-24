import type { QQChannelSettings } from '@/libs/channels/qq/advancedSettings'
import {
  DEFAULT_QQ_CHANNEL_SETTINGS,
  QQ_DEFAULT_CHAR_LIMIT,
  QQ_PLATFORM_MAX_TEXT_LENGTH,
  evaluateQQInboundAccess,
  normalizeQQChannelSettings,
  chunkQQOutboundText,
} from '@/libs/channels/qq/advancedSettings'

describe('normalizeQQChannelSettings', () => {
  it('fills defaults for empty payloads', () => {
    expect(normalizeQQChannelSettings(null)).toEqual(DEFAULT_QQ_CHANNEL_SETTINGS)
  })

  it('clamps charLimit to the platform max', () => {
    expect(normalizeQQChannelSettings({ charLimit: 9999 }).charLimit).toBe(QQ_PLATFORM_MAX_TEXT_LENGTH)
    expect(normalizeQQChannelSettings({ charLimit: 0 }).charLimit).toBe(1)
  })

  it('dedupes allowed users and trims ids', () => {
    expect(
      normalizeQQChannelSettings({
        allowedUsers: [
          { platformUserId: ' a ', remark: ' Alice ' },
          { platformUserId: 'a' },
          { platformUserId: '' },
        ],
      }).allowedUsers
    ).toEqual([{ platformUserId: 'a', remark: 'Alice' }])
  })
})

describe('evaluateQQInboundAccess', () => {
  const base: QQChannelSettings = {
    ...DEFAULT_QQ_CHANNEL_SETTINGS,
    platformUserId: 'owner-1',
  }

  it('rejects everyone when disabled, including the owner', () => {
    expect(
      evaluateQQInboundAccess({
        authorId: 'owner-1',
        settings: { ...base, dmPolicy: 'disabled' },
        threadType: 'c2c',
      }).ok
    ).toBe(false)
  })

  it('fails closed for empty allowlist and trusts the owner', () => {
    expect(
      evaluateQQInboundAccess({
        authorId: 'stranger',
        settings: { ...base, dmPolicy: 'allowlist', allowedUsers: [] },
        threadType: 'c2c',
      }).ok
    ).toBe(false)
    expect(
      evaluateQQInboundAccess({
        authorId: 'owner-1',
        settings: { ...base, dmPolicy: 'allowlist', allowedUsers: [] },
        threadType: 'c2c',
      }).ok
    ).toBe(true)
  })

  it('ignores allowlist entries under open policy', () => {
    const settings: QQChannelSettings = {
      ...base,
      allowedUsers: [{ platformUserId: 'friend-1' }],
      dmPolicy: 'open',
    }
    expect(evaluateQQInboundAccess({ authorId: 'friend-1', settings, threadType: 'c2c' }).ok).toBe(true)
    expect(evaluateQQInboundAccess({ authorId: 'owner-1', settings, threadType: 'c2c' }).ok).toBe(true)
    expect(evaluateQQInboundAccess({ authorId: 'stranger', settings, threadType: 'c2c' }).ok).toBe(true)
  })
})

describe('chunkQQOutboundText', () => {
  it('returns a single chunk for short text', () => {
    const text = 'a'.repeat(50)
    expect(chunkQQOutboundText(text, QQ_DEFAULT_CHAR_LIMIT)).toEqual([text])
  })

  it('splits by binding charLimit without exceeding the platform max', () => {
    expect(chunkQQOutboundText('a'.repeat(25), 10)).toEqual(['aaaaaaaaaa', 'aaaaaaaaaa', 'aaaaa'])
    // charLimit above platform max is clamped to 2000 → 4500 chars = 3 chunks
    expect(chunkQQOutboundText('a'.repeat(4500), 5000)).toEqual([
      'a'.repeat(QQ_PLATFORM_MAX_TEXT_LENGTH),
      'a'.repeat(QQ_PLATFORM_MAX_TEXT_LENGTH),
      'a'.repeat(4500 - QQ_PLATFORM_MAX_TEXT_LENGTH * 2),
    ])
  })
})
