import { docsSearch } from '@/lib/search'
import { SITE_URL } from '@/lib/site'
import { tool } from 'ai'
import { searchDocsInputSchema } from '@/lib/ai-schema'

const markTagPattern = /<\/?mark>/g

export const searchDocs = tool({
  description: '搜索 PureChatNext 的公开中文文档。在回答任何产品、配置、部署或开发问题前必须调用。',
  inputSchema: searchDocsInputSchema,
  execute: async ({ query }) => {
    const results = await docsSearch.search(query, { limit: 5 })

    return results.map((result) => ({
      breadcrumbs: result.breadcrumbs?.map((item) => item.replace(markTagPattern, '')),
      content: result.content.replace(markTagPattern, ''),
      type: result.type,
      url: new URL(result.url, SITE_URL).toString(),
    }))
  },
})

export const docsTools = { searchDocs }
