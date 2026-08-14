import { SHANGHAI_TIMEZONE } from '@pure/const'

export const buildChatRuntimeInstructions = (now = new Date()) => {
  const currentTime = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'full',
    timeStyle: 'long',
    timeZone: SHANGHAI_TIMEZONE,
  }).format(now)

  return `当前日期与时间：${currentTime}（${SHANGHAI_TIMEZONE}）。涉及“今天、明天、现在”等相对时间时，以此为准。`
}
