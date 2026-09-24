/**
 * QQ 出站文本分片与长度常量（浏览器安全，无 node:crypto）。
 */

/** QQ OpenAPI 单条文本消息硬上限（与微信 iLink 对齐）。 */
export const QQ_MAX_TEXT_LENGTH = 2000
/** 同一入站 `msg_id` 下被动回复的最大条数（含 agent 分片与代发）。 */
export const QQ_MAX_PASSIVE_REPLIES = 5

/**
 * 在 `[offset, hardEnd)` 内找更自然的断点（优先换行 / 句末 / 分句 / 空白）。
 * 找不到则退回 `hardEnd`（仍会做代理对修正）。
 */
function findQQChunkEnd(text: string, offset: number, hardEnd: number): number {
  if (hardEnd >= text.length) return text.length
  // 至少保留 40% 内容，只在后半段里找断点，避免切得过碎。
  const minEnd = offset + Math.max(1, Math.ceil((hardEnd - offset) * 0.4))
  const regionStart = minEnd
  const region = text.slice(regionStart, hardEnd)
  const patterns = [
    /(?:\r\n|\n|\r)/g,
    /[。！？.!?][”’」』】）)\]]?/g,
    /[；;]/g,
    /[，,、]/g,
    /\s/g,
  ]
  for (const pattern of patterns) {
    let best = -1
    for (const match of region.matchAll(pattern)) {
      const at = match.index + match[0].length
      if (regionStart + at > offset) best = at
    }
    if (best > 0) return regionStart + best
  }
  return hardEnd
}

/**
 * 按长度切分出站文本；短文本返回单元素数组。
 * 优先在换行 / 句读处断开；切分点避开 UTF-16 代理对中间。
 */
export function chunkQQText(text: string, limit: number = QQ_MAX_TEXT_LENGTH): string[] {
  const parsed = Math.floor(Number(limit))
  const size = Number.isFinite(parsed) ? Math.max(1, parsed) : QQ_MAX_TEXT_LENGTH
  if (text.length <= size) return [text]
  const chunks: string[] = []
  for (let offset = 0; offset < text.length; ) {
    let end = findQQChunkEnd(text, offset, Math.min(offset + size, text.length))
    // 若 end 落在低代理上，说明切开了代理对，回退一位。
    if (end < text.length && end > offset && (text.charCodeAt(end) & 0xfc00) === 0xdc00) end -= 1
    if (end <= offset) end = Math.min(offset + 2, text.length)
    chunks.push(text.slice(offset, end))
    offset = end
  }
  return chunks
}

/**
 * 按 `limit` 分片，且最多保留 `maxChunks` 片；超出时截断并追加省略号。
 */
export function chunkQQTextLimited(text: string, limit: number, maxChunks: number): string[] {
  const parsed = Math.floor(Number(limit))
  const size = Number.isFinite(parsed) ? Math.max(1, parsed) : QQ_MAX_TEXT_LENGTH
  const budgetChunks = Math.max(0, Math.floor(Number(maxChunks)) || 0)
  if (budgetChunks <= 0) return []
  const chunks = chunkQQText(text, size)
  if (chunks.length <= budgetChunks) return chunks
  const budget = budgetChunks * size
  const clipped = text.length > budget ? `${text.slice(0, Math.max(0, budget - 3))}...` : text
  return chunkQQText(clipped, size).slice(0, budgetChunks)
}
