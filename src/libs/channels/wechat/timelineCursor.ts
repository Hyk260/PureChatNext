export type WechatTimelineCursor = {
  createdAt: Date
  id: string
}

type SerializedWechatTimelineCursor = {
  createdAt: string
  id: string
}

export function compareWechatTimelineCursors(a: WechatTimelineCursor, b: WechatTimelineCursor): number {
  const timeDifference = a.createdAt.getTime() - b.createdAt.getTime()
  return timeDifference || (a.id === b.id ? 0 : a.id < b.id ? -1 : 1)
}

export function advanceWechatTimelineCursor(
  current: WechatTimelineCursor | null,
  candidates: Iterable<WechatTimelineCursor>
): WechatTimelineCursor | null {
  let newest = current
  for (const candidate of candidates) {
    if (!newest || compareWechatTimelineCursors(candidate, newest) > 0) newest = candidate
  }
  return newest
}

export function encodeWechatTimelineCursor(cursor: WechatTimelineCursor): string {
  const value: SerializedWechatTimelineCursor = {
    createdAt: cursor.createdAt.toISOString(),
    id: cursor.id,
  }
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export function parseWechatTimelineCursor(value: string): WechatTimelineCursor | null {
  if (value.length > 512) return null
  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8')
    ) as Partial<SerializedWechatTimelineCursor>
    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string' || parsed.id.length > 128) return null
    const createdAt = new Date(parsed.createdAt)
    if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== parsed.createdAt) return null
    return { createdAt, id: parsed.id }
  } catch {
    return null
  }
}
