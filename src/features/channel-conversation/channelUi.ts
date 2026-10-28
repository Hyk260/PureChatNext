export function truncateId(id: string, head = 8, tail = 4) {
  if (id.length <= head + tail + 1) return id
  return `${id.slice(0, head)}…${id.slice(-tail)}`
}

export function channelAccessLabel(canSend: boolean, isOwnBinding?: boolean) {
  if (canSend) return '可代发'
  if (isOwnBinding) return '只读'
  return '其它账号'
}

export function channelBubbleClass(isUser: boolean, options?: { hasMedia?: boolean; isRight?: boolean }) {
  const isRight = options?.isRight ?? isUser
  const corner = isRight ? 'rounded-br-md' : 'rounded-bl-md'
  if (isUser && options?.hasMedia) return `overflow-hidden ${corner} bg-transparent p-0 shadow-none`
  if (isUser) return `${corner} bg-primary px-3.5 py-2.5 text-primary-foreground`
  return `${corner} bg-muted px-3.5 py-2.5 text-foreground ring-1 ring-border`
}

/** Channel-monitor duration label (ms under 1s; otherwise seconds with adaptive precision). */
export function formatChannelDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs}ms`
  const precision = durationMs < 10_000 ? 1 : 0
  return `${(durationMs / 1000).toFixed(precision)}s`
}

export const COPIED_FEEDBACK_MS = 1600
export const CHANNEL_STATUS_POLL_MS = 30_000
export const CHANNEL_SESSION_POLL_MS = 30_000

const IMAGE_FILE_RE = /\.(jpe?g|png|gif|webp|bmp)$/i

/** 渠道会话共用：按 MIME / 文件名判断是否按图片预览。 */
export function isChannelImageFileName(fileName?: string, mimeType?: string) {
  if (mimeType?.startsWith('image/')) return true
  return IMAGE_FILE_RE.test(fileName || '')
}
