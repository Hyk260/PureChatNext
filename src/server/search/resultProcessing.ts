import { DEFAULT_WEB_SEARCH_SETTINGS } from '@pure/types'
import type { WebSearchSettings } from '@pure/types'
import { sliceByTokens } from '@pure/utils'

const escapeRegex = (text: string) => text.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')

export function compileBlacklistRule(rule: string): RegExp {
  if (rule.startsWith('/') && rule.endsWith('/')) return new RegExp(rule.slice(1, -1), 'i')
  if (rule === '<all_urls>') return /^https?:\/\//i
  const match = /^(\*|https?):\/\/(\*|(?:\*\.)?[a-z\d.-]+)(\/[^\s]*)$/i.exec(rule)
  if (!match) throw new Error('使用 URL 匹配模式或 /正则表达式/')
  const [, rawScheme, rawHost, path] = match
  const scheme = rawScheme.toLowerCase()
  const host = rawHost.toLowerCase()
  const hostPattern =
    host === '*' ? '[^/]+' : host.startsWith('*.') ? `(?:[^/]+\\.)?${escapeRegex(host.slice(2))}` : escapeRegex(host)
  return new RegExp(
    `^${scheme === '*' ? 'https?' : scheme}://${hostPattern}(?::[0-9]+)?${escapeRegex(path).replaceAll('*', '.*')}$`
  )
}

export function invalidBlacklistRules(rules: string[]) {
  return rules.filter((rule) => {
    try {
      compileBlacklistRule(rule)
      return false
    } catch {
      return true
    }
  })
}

export function normalizeWebUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

export function isBlockedWebUrl(url: string, rules: string[]) {
  return rules.some((rule) => compileBlacklistRule(rule).test(url))
}

export function processWebResults<T extends { url: string; content: string }>(
  results: T[],
  settings: WebSearchSettings
): T[] {
  const config = { ...DEFAULT_WEB_SEARCH_SETTINGS, ...settings }
  const patterns = config.blacklist.map(compileBlacklistRule)
  const seen = new Set<string>()
  const filtered: T[] = []
  for (const result of results) {
    const url = normalizeWebUrl(result.url)
    if (!url || seen.has(url) || patterns.some((pattern) => pattern.test(url))) continue
    seen.add(url)
    filtered.push({ ...result, url })
    if (filtered.length >= config.maxResults) break
  }
  if (config.compression === 'none' || !filtered.length) return filtered
  const budget = Math.max(1, Math.floor(config.cutoffLimit / filtered.length))
  return filtered.map((result) => {
    const content = sliceByTokens(result.content, 0, budget)
    return { ...result, content: content.length < result.content.length ? `${content}…` : content }
  })
}
