import { tool } from 'ai'
import { searchDocsInputSchema } from '@/lib/ai-schema'
import { toDocsRelativeHref } from '@/lib/ask-ai-session'
import { docsSearch } from '@/lib/search'

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
      url: toDocsRelativeHref(result.url),
    }))
  },
})

export const docsTools = { searchDocs }
