export function safeFileName(name: string, fallback = 'file') {
  const base = name.split(/[/\\]/).pop()?.trim() || fallback
  return base.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 180) || fallback
}
