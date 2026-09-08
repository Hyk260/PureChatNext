import { SHANGHAI_TIMEZONE } from '@pure/const'
import { formatFullDateTime } from '@pure/utils'

export const buildChatRuntimeInstructions = (now = new Date()) => {
  const currentTime = formatFullDateTime(now, { timeZone: SHANGHAI_TIMEZONE })

  return `当前日期与时间：${currentTime}（${SHANGHAI_TIMEZONE}）。涉及“今天、明天、现在”等相对时间时，以此为准。`
}
