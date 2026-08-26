import { describe, expect, it } from 'vitest'
import { getMarkdownText, getMarkdownUrl, resolveMarkdownSlug } from '@/lib/markdown'
import { SITE_URL } from '@/lib/site'

describe('Markdown page mapping', () => {
  it('maps README routes to stable markdown URLs', () => {
    expect(getMarkdownUrl('/')).toBe('/index.md')
    expect(getMarkdownUrl('/development')).toBe('/development.md')
    expect(getMarkdownUrl('/getting-started/quick-start')).toBe('/getting-started/quick-start.md')
  })

  it('maps the public index back to the root page', () => {
    expect(resolveMarkdownSlug()).toBeUndefined()
    expect(resolveMarkdownSlug([])).toBeUndefined()
    expect(resolveMarkdownSlug(['index'])).toBeUndefined()
    expect(resolveMarkdownSlug(['development'])).toEqual(['development'])
  })

  it('includes page metadata and canonical URL in copied markdown', async () => {
    const page = {
      data: {
        description: '用于测试的页面描述。',
        getText: async () => '## 正文\n\n```ts\nconst ok = true\n```',
        title: '测试页面',
      },
      url: '/development/test',
    }

    await expect(getMarkdownText(page)).resolves.toContain('# 测试页面')
    await expect(getMarkdownText(page)).resolves.toContain(`${SITE_URL}/development/test`)
    await expect(getMarkdownText(page)).resolves.toContain('```ts')
  })

  it('replaces the source H1 instead of duplicating it', async () => {
    const page = {
      data: {
        description: '页面描述。',
        getText: async () => '# 源文件标题\n\n## 正文',
        title: 'Frontmatter 标题',
      },
      url: '/',
    }

    const markdown = await getMarkdownText(page)

    expect(markdown.match(/^# /gm)).toEqual(['# '])
    expect(markdown).not.toContain('源文件标题')
    expect(markdown).toContain('## 正文')
  })
})
