export function isBrowserUrl(value: string): boolean {
  if (value === 'about:blank') return true
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}

export function normalizeBrowserUrl(value: string): string {
  const text = value.trim()
  if (!text) return 'about:blank'
  if (isBrowserUrl(text)) return new URL(text).href
  const local = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:[/?#].*)?$/i.test(text)
  const hostWithPort = /^(?:[^/:?#\s]+\.)+[^/:?#\s]+:\d+(?:[/?#]|$)/u.test(text)
  if (!local && !hostWithPort && /^[a-z][\w+.-]*:/i.test(text)) throw new Error('仅支持 HTTP 和 HTTPS 网址')
  if (local || (!/\s/.test(text) && text.includes('.'))) {
    const url = `${local ? 'http' : 'https'}://${text}`
    if (!isBrowserUrl(url)) throw new Error('网址无效')
    return new URL(url).href
  }
  return `https://www.bing.com/search?q=${encodeURIComponent(text)}`
}
