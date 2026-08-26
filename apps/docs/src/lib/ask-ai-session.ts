import { localStg } from '@pure/utils/storage'
import { safeValidateUIMessages } from 'ai'
import type { UIMessage } from 'ai'
import { SITE_URL } from '@/lib/site'

export const ASK_AI_MESSAGES_KEY = 'purechat:docs:ask-ai:v1'

const DOCS_HOSTS = new Set([new URL(SITE_URL).hostname, 'localhost', '127.0.0.1'])

function decodeHash(hash: string) {
  if (!hash) return ''
  try {
    return decodeURI(hash)
  } catch {
    return hash
  }
}

export function toDocsRelativeHref(href: string) {
  const trimmed = href.trim()
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) {
    return trimmed
  }

  try {
    const url = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed, SITE_URL)
    if (!DOCS_HOSTS.has(url.hostname)) return trimmed

    const path = `${url.pathname}${url.search}${decodeHash(url.hash)}`
    return path.startsWith('/') ? path : `/${path}`
  } catch {
    return trimmed
  }
}

export function rewriteDocsMarkdownHrefs(markdown: string) {
  return markdown.replace(/\]\(([^)]+)\)/g, (full, rawHref: string) => {
    const href = rawHref.trim()
    if (!href) return full

    const [target = href, ...rest] = href.split(/\s+/)
    const next = toDocsRelativeHref(target)
    if (next === target) return full

    const suffix = rest.length ? ` ${rest.join(' ')}` : ''
    return `](${next}${suffix})`
  })
}

export async function loadAskAIMessages(): Promise<UIMessage[]> {
  const stored = localStg.getJson(ASK_AI_MESSAGES_KEY)
  if (!Array.isArray(stored) || stored.length === 0) return []

  const validated = await safeValidateUIMessages({ messages: stored })
  return validated.success ? validated.data : []
}

export function saveAskAIMessages(messages: UIMessage[]) {
  if (messages.length === 0) {
    localStg.remove(ASK_AI_MESSAGES_KEY)
    return
  }

  const stored = messages.map((message) => {
    if (message.role !== 'assistant') return message
    return {
      ...message,
      parts: message.parts.map((part) => {
        if (part.type !== 'text') return part
        return { ...part, text: rewriteDocsMarkdownHrefs(part.text) }
      }),
    }
  })

  localStg.setJson(ASK_AI_MESSAGES_KEY, stored)
}
