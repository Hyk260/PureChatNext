import { describe, expect, it } from 'vitest'

import { resolveQQPassiveReply } from '../passiveReply'

const inboundCreatedAt = new Date('2026-09-07T08:00:00.000Z')

describe('resolveQQPassiveReply', () => {
  it('requires a recent inbound msg_id for group threads', () => {
    expect(
      resolveQQPassiveReply({
        hasAgentReply: false,
        outboundCount: 0,
        threadType: 'group',
      })
    ).toEqual({
      error: '群聊无法主动发消息。请先让用户在群里 @ 机器人，并在 5 分钟内回复。',
      ok: false,
    })
  })

  it('rejects group replies after the 5 minute window', () => {
    expect(
      resolveQQPassiveReply({
        hasAgentReply: false,
        inboundCreatedAt,
        now: new Date('2026-09-07T08:06:00.000Z'),
        outboundCount: 0,
        platformMessageId: 'msg-1',
        threadType: 'group',
      })
    ).toMatchObject({ ok: false })
  })

  it('increments msg_seq after an agent reply and completed outbound', () => {
    expect(
      resolveQQPassiveReply({
        hasAgentReply: true,
        inboundCreatedAt,
        now: new Date('2026-09-07T08:01:00.000Z'),
        outboundCount: 1,
        platformMessageId: 'msg-1',
        threadType: 'group',
      })
    ).toEqual({
      ok: true,
      reply: { msgId: 'msg-1', msgSeq: 3 },
    })
  })

  it('allows c2c replies within 60 minutes', () => {
    expect(
      resolveQQPassiveReply({
        hasAgentReply: false,
        inboundCreatedAt,
        now: new Date('2026-09-07T08:50:00.000Z'),
        outboundCount: 0,
        platformMessageId: 'msg-2',
        threadType: 'c2c',
      })
    ).toEqual({
      ok: true,
      reply: { msgId: 'msg-2', msgSeq: 1 },
    })
  })
})
