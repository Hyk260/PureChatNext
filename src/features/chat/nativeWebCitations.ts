import { isRecord } from '@pure/utils/object'
import type { UIMessage } from 'ai'

type TextPart = Extract<UIMessage['parts'][number], { type: 'text' }>
type Citation = { start: number; end: number; url: string }

export function formatNativeWebCitations(part: TextPart): string {
  const metadata = part.providerMetadata?.openai
  if (!isRecord(metadata) || !Array.isArray(metadata.annotations)) return part.text
  const citations: Citation[] = metadata.annotations.flatMap((annotation) => {
    if (!isRecord(annotation) || annotation.type !== 'url_citation') return []
    const { start_index: start, end_index: end, url: value } = annotation
    if (typeof start !== 'number' || typeof end !== 'number' || typeof value !== 'string') return []
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > part.text.length)
      return []
    try {
      const url = new URL(value)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return []
      return [{ start, end, url: url.toString().replace(/[()]/g, (character) => (character === '(' ? '%28' : '%29')) }]
    } catch {
      return []
    }
  })
  let cursor = 0
  let text = ''
  citations
    .sort((a, b) => a.start - b.start)
    .forEach((citation, index) => {
      if (citation.start < cursor) return
      text += `${part.text.slice(cursor, citation.start)}[[${index + 1}]](${citation.url})`
      cursor = citation.end
    })
  return text + part.text.slice(cursor)
}
