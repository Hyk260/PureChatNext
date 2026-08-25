import { SITE_URL } from '@/lib/site'
import type { source } from '@/lib/source'

export type DocsPage = (typeof source)['$inferPage']
type MarkdownPage = Pick<DocsPage, 'url'> & {
  data: Pick<DocsPage['data'], 'description' | 'getText' | 'title'>
}

export function getMarkdownUrl(pageUrl: string) {
  return pageUrl === '/' ? '/index.md' : `${pageUrl}.md`
}

export function resolveMarkdownSlug(slug?: string[]) {
  if (!slug || slug.length === 0 || (slug.length === 1 && slug[0] === 'index')) return undefined
  return slug
}

export async function getMarkdownText(page: MarkdownPage) {
  const markdown = await page.data.getText('processed')
  const canonical = new URL(page.url, SITE_URL).toString()
  const body = markdown.replace(/^\s*# .+(?:\r?\n)+/, '')

  return `# ${page.data.title}\n\n> ${page.data.description}\n\n来源：${canonical}\n\n${body}`
}
