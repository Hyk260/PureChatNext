const DSML_MARKUP_PATTERN = /｜{1,2}DSML｜{1,2}|<\s*tool_calls\b|<\s*invoke\s+name\s*=/i

export const CHANNEL_FINAL_ANSWER_INSTRUCTION =
  '现在必须根据已有工具结果，用中文直接回答用户。禁止再次调用工具，禁止输出 XML、DSML、tool_calls 或任何工具调用标记。'

export const CHANNEL_UNREADABLE_REPLY = '刚才检索到了资料，但没有整理成可读回复。请再发一次同样的问题。'

export const CHANNEL_EMPTY_REPLY = '（模型未返回内容）'

export const isLeakedToolMarkup = (text: string) => DSML_MARKUP_PATTERN.test(text)

export const sanitizeChannelReplyText = (text: string) => {
  const trimmed = text.trim()
  if (!trimmed || isLeakedToolMarkup(trimmed)) return ''
  return trimmed
}

export const resolveChannelReplyText = (text: string, hadToolCalls = false) => {
  const sanitized = sanitizeChannelReplyText(text)
  if (sanitized) return sanitized
  if (hadToolCalls || isLeakedToolMarkup(text)) return CHANNEL_UNREADABLE_REPLY
  return CHANNEL_EMPTY_REPLY
}
