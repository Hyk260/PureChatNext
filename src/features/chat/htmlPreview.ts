const HTML_PREVIEW_LANGUAGES = new Set(['htm', 'html', 'svg'])
const FULL_HTML_MARKERS = ['<!doctype html', '<html'] as const

const BLANK_DOCUMENT =
  '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>'

export function isHtmlPreviewLanguage(language?: string) {
  if (!language) return false
  return HTML_PREVIEW_LANGUAGES.has(language.trim().toLowerCase())
}

function isFullHtmlDocument(content: string) {
  const head = content.slice(0, 1024).toLowerCase()
  return FULL_HTML_MARKERS.some((marker) => head.includes(marker))
}

export function toHtmlPreviewSrcDoc(content: string, language = 'html') {
  const trimmed = content.trim()
  if (!trimmed) return BLANK_DOCUMENT
  if (isFullHtmlDocument(trimmed)) return trimmed

  const body =
    language.trim().toLowerCase() === 'svg'
      ? `<main style="display:grid;place-items:center;min-height:100vh">${trimmed}</main>`
      : trimmed

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${body}</body></html>`
}
