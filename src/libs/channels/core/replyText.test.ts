import { describe, expect, it } from 'vitest'

import {
  CHANNEL_EMPTY_REPLY,
  CHANNEL_UNREADABLE_REPLY,
  isLeakedToolMarkup,
  resolveChannelReplyText,
  sanitizeChannelReplyText,
} from './replyText'

const leakedDsml = `<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="webSearch">
<｜｜DSML｜｜parameter name="query" string="true">新华社 要闻 最新</｜｜DSML｜｜parameter>
</｜｜DSML｜｜invoke>
</｜｜DSML｜｜tool_calls>`

describe('channel reply text', () => {
  it('detects DeepSeek DSML tool markup', () => {
    expect(isLeakedToolMarkup(leakedDsml)).toBe(true)
    expect(isLeakedToolMarkup('今日国内要闻：瑞金至延安高铁开通。')).toBe(false)
  })

  it('drops leaked tool markup instead of sending query fragments', () => {
    expect(sanitizeChannelReplyText(leakedDsml)).toBe('')
    expect(sanitizeChannelReplyText('  今日要闻  ')).toBe('今日要闻')
  })

  it('uses a retry prompt when tools ran but the model leaked markup', () => {
    expect(resolveChannelReplyText(leakedDsml, true)).toBe(CHANNEL_UNREADABLE_REPLY)
    expect(resolveChannelReplyText('', false)).toBe(CHANNEL_EMPTY_REPLY)
    expect(resolveChannelReplyText('今日要闻', true)).toBe('今日要闻')
  })
})
