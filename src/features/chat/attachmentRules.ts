export const CHAT_ATTACHMENT_ACCEPT = 'image/*,.txt,.md,.csv,.pdf,.doc,.docx,.xls,.xlsx,.pptx'
export const MAX_CHAT_ATTACHMENTS = 8
export const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024

export const validateChatAttachments = (files: File[], existingCount = 0): string | null => {
  if (existingCount + files.length > MAX_CHAT_ATTACHMENTS) return `最多支持 ${MAX_CHAT_ATTACHMENTS} 个附件`

  const oversized = files.find((file) => file.size > MAX_CHAT_ATTACHMENT_BYTES)
  if (oversized) return `附件「${oversized.name}」超过 10MB 限制`

  return null
}
