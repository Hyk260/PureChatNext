import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { optionalNumberEnv, optionalUrlEnv } from './helpers'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      ANSPIRE_API_KEY?: string
      BOCHA_API_KEY?: string
      BRAVE_API_KEY?: string
      EXA_API_KEY?: string
      FIRECRAWL_API_KEY?: string
      FIRECRAWL_URL?: string
      GOOGLE_PSE_API_KEY?: string
      GOOGLE_PSE_ENGINE_ID?: string
      JINA_READER_API_KEY?: string
      JINA_API_KEY?: string
      KAGI_API_KEY?: string
      SEARCH1API_API_KEY?: string
      SEARCH1API_SEARCH_API_KEY?: string
      SEARCH1API_CRAWL_API_KEY?: string
      TAVILY_API_KEY?: string
      BROWSERLESS_TOKEN?: string
      BROWSERLESS_URL?: string

      /** 网页抓取并发数，取值范围为 `1`–`10`。 */
      CRAWL_CONCURRENCY?: string
      /** 网页抓取失败重试次数，取值范围为 `0`–`3`。 */
      CRAWLER_RETRY?: string
      /** 网页抓取实现列表；多个实现通常使用逗号分隔。 */
      CRAWLER_IMPLS?: string
      /** 工具调用审批签名密钥，至少 32 个字符。 */
      TOOL_APPROVAL_SECRET?: string
      /** 是否优先使用国内域名访问 Jina 服务。 */
      JINA_USE_CN_DOMAINS?: string
      /** 搜索提供商列表；多个提供商使用逗号分隔。 */
      SEARCH_PROVIDERS?: string
      /** SearXNG 服务地址。 */
      SEARXNG_URL?: string
      /** 视觉理解使用的模型名称。 */
      VISUAL_UNDERSTANDING_MODEL?: string
      /** 视觉理解模型对应的 Provider 名称。 */
      VISUAL_UNDERSTANDING_PROVIDER?: string
    }
  }
}

export const getToolsConfig = () => {
  return createEnv({
    runtimeEnv: {
      ANSPIRE_API_KEY: process.env.ANSPIRE_API_KEY,
      BOCHA_API_KEY: process.env.BOCHA_API_KEY,
      BRAVE_API_KEY: process.env.BRAVE_API_KEY,
      EXA_API_KEY: process.env.EXA_API_KEY,
      FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
      FIRECRAWL_URL: process.env.FIRECRAWL_URL,
      GOOGLE_PSE_API_KEY: process.env.GOOGLE_PSE_API_KEY,
      GOOGLE_PSE_ENGINE_ID: process.env.GOOGLE_PSE_ENGINE_ID,
      JINA_READER_API_KEY: process.env.JINA_READER_API_KEY,
      JINA_API_KEY: process.env.JINA_API_KEY,
      KAGI_API_KEY: process.env.KAGI_API_KEY,
      SEARCH1API_API_KEY: process.env.SEARCH1API_API_KEY,
      SEARCH1API_SEARCH_API_KEY: process.env.SEARCH1API_SEARCH_API_KEY,
      SEARCH1API_CRAWL_API_KEY: process.env.SEARCH1API_CRAWL_API_KEY,
      TAVILY_API_KEY: process.env.TAVILY_API_KEY,
      BROWSERLESS_TOKEN: process.env.BROWSERLESS_TOKEN,
      BROWSERLESS_URL: process.env.BROWSERLESS_URL,

      CRAWL_CONCURRENCY: process.env.CRAWL_CONCURRENCY,
      CRAWLER_RETRY: process.env.CRAWLER_RETRY,
      CRAWLER_IMPLS: process.env.CRAWLER_IMPLS,
      TOOL_APPROVAL_SECRET: process.env.TOOL_APPROVAL_SECRET,
      JINA_USE_CN_DOMAINS: process.env.JINA_USE_CN_DOMAINS,
      SEARCH_PROVIDERS: process.env.SEARCH_PROVIDERS,
      SEARXNG_URL: process.env.SEARXNG_URL,
      VISUAL_UNDERSTANDING_MODEL: process.env.VISUAL_UNDERSTANDING_MODEL,
      VISUAL_UNDERSTANDING_PROVIDER: process.env.VISUAL_UNDERSTANDING_PROVIDER,
    },
    server: {
      ANSPIRE_API_KEY: z.string().optional(),
      BOCHA_API_KEY: z.string().optional(),
      BRAVE_API_KEY: z.string().optional(),
      EXA_API_KEY: z.string().optional(),
      FIRECRAWL_API_KEY: z.string().optional(),
      FIRECRAWL_URL: optionalUrlEnv(),
      GOOGLE_PSE_API_KEY: z.string().optional(),
      GOOGLE_PSE_ENGINE_ID: z.string().optional(),
      JINA_READER_API_KEY: z.string().optional(),
      JINA_API_KEY: z.string().optional(),
      KAGI_API_KEY: z.string().optional(),
      SEARCH1API_API_KEY: z.string().optional(),
      SEARCH1API_SEARCH_API_KEY: z.string().optional(),
      SEARCH1API_CRAWL_API_KEY: z.string().optional(),
      TAVILY_API_KEY: z.string().optional(),
      BROWSERLESS_TOKEN: z.string().optional(),
      BROWSERLESS_URL: optionalUrlEnv(),

      /** 网页抓取并发数，取值范围为 `1`–`10`。 */
      CRAWL_CONCURRENCY: optionalNumberEnv(1, 10),
      /** 网页抓取失败重试次数，取值范围为 `0`–`3`。 */
      CRAWLER_RETRY: optionalNumberEnv(0, 3),
      /** 网页抓取实现列表；多个实现通常使用逗号分隔。 */
      CRAWLER_IMPLS: z.string().optional(),
      /** 工具调用审批签名密钥，至少 32 个字符。 */
      TOOL_APPROVAL_SECRET: z.string().min(32).optional(),
      /** 是否优先使用国内域名访问 Jina 服务。 */
      JINA_USE_CN_DOMAINS: z.enum(['true', 'false']).default('true'),
      /** 搜索提供商列表；多个提供商使用逗号分隔。 */
      SEARCH_PROVIDERS: z.string().optional(),
      /** SearXNG 服务地址。 */
      SEARXNG_URL: optionalUrlEnv(),
      /** 视觉理解使用的模型名称。 */
      VISUAL_UNDERSTANDING_MODEL: z.string().optional(),
      /** 视觉理解模型对应的 Provider 名称。 */
      VISUAL_UNDERSTANDING_PROVIDER: z.string().optional(),
    },
  })
}

export const toolsEnv = getToolsConfig()
