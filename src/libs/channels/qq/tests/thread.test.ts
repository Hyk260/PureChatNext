import type { Message, Thread } from 'chat'
import { describe, expect, it } from 'vitest'

import { resolveQQAuthorLabel, resolveQQSessionLabel } from '../thread'

const thread = (id: string) => ({ id }) as Thread
const message = (author?: { fullName?: string; userId?: string; userName?: string }) =>
  ({ author }) as Message

describe('resolveQQSessionLabel', () => {
  it('uses the group thread identity instead of the last speaker', () => {
    expect(
      resolveQQSessionLabel(
        thread('qq:group:group_1'),
        message({ fullName: '染忆', userId: '24B45D69', userName: '染忆' })
      )
    ).toBe('QQ 群聊 group_1')
  })

  it('falls back to group thread label when username is missing', () => {
    expect(resolveQQSessionLabel(thread('qq:group:group_1'), message({ userId: '24B45D69' }))).toBe(
      'QQ 群聊 group_1'
    )
  })

  it('prefers the QQ username for c2c sessions', () => {
    expect(
      resolveQQSessionLabel(
        thread('qq:c2c:user_1'),
        message({ fullName: '临江仙', userId: 'user_1', userName: '临江仙' })
      )
    ).toBe('临江仙')
  })

  it('falls back to c2c thread label when username is a placeholder', () => {
    expect(
      resolveQQSessionLabel(
        thread('qq:c2c:user_1'),
        message({ fullName: 'Unknown', userId: 'user_1', userName: 'unknown' })
      )
    ).toBe('QQ 单聊 user_1')
  })
})

describe('resolveQQAuthorLabel', () => {
  it('prefers the QQ username', () => {
    expect(resolveQQAuthorLabel(message({ fullName: '染忆', userId: '24B45D69', userName: '染忆' }))).toBe('染忆')
  })

  it('ignores openid fallbacks that are not nicknames', () => {
    expect(resolveQQAuthorLabel(message({ fullName: '24B45D69', userId: '24B45D69', userName: '24B45D69' }))).toBeNull()
    expect(resolveQQAuthorLabel(message({ userId: '24B45D69' }))).toBeNull()
  })
})
