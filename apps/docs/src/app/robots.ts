import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-url'

/**
 * AI 检索/训练爬虫单独放行 Markdown 原文（`/*.md` 重写到 `raw-content`），
 * 搜索引擎则屏蔽，避免 Markdown 与 HTML 正文产生重复内容。
 */
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'anthropic-ai',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
]

const robots = (): MetadataRoute.Robots => {
  const siteUrl = getSiteUrl()

  return {
    host: siteUrl.origin,
    rules: [
      ...AI_CRAWLERS.map((userAgent) => ({
        allow: ['/', '/*.md'],
        disallow: '/api/',
        userAgent,
      })),
      {
        allow: '/',
        disallow: ['/api/', '/raw-content/', '/*.md'],
        userAgent: '*',
      },
    ],
    sitemap: new URL('/sitemap.xml', siteUrl).toString(),
  }
}

export default robots
