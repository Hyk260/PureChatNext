import { getSiteUrl } from '@/lib/site-url'
import { source } from '@/lib/source'
import { getMarkdownUrl } from '@/lib/markdown'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site'

export const revalidate = false

/** AI 检索入口：https://llmstxt.org —— 列出站点定位与可直接抓取的 Markdown 原文。 */
const GET = (): Response => {
  const siteUrl = getSiteUrl()
  const pages = source.getPages()

  const lines = [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_DESCRIPTION}`,
    '',
    `本站点是 PureChat 自托管 AI 工作台的中文文档，覆盖自托管部署、Docker 与服务器配置、微信与 QQ 渠道接入，以及开发参考。`,
    '',
    '## 文档',
    '',
    ...pages.map((page) => {
      const url = new URL(page.url, siteUrl).toString()
      const markdown = new URL(getMarkdownUrl(page.url), siteUrl).toString()
      const description = page.data.description ? `：${page.data.description}` : ''

      return `- [${page.data.title}](${url})${description}（Markdown 原文：${markdown}）`
    }),
    '',
  ]

  return new Response(lines.join('\n'), {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}

export { GET }
