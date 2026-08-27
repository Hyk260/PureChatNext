import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { optionalNumberEnv, optionalUrlEnv } from './helpers'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
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
      /** 网页抓取并发数，取值范围为 `1`–`10`。 */
      CRAWL_CONCURRENCY: optionalNumberEnv(1, 10),
      /** 网页抓取失败重试次数，取值范围为 `0`–`3`。 */
      CRAWLER_RETRY: optionalNumberEnv(0, 3),
      /** 网页抓取实现列表；多个实现通常使用逗号分隔。 */
      CRAWLER_IMPLS: z.string().optional(),
      /** 工具调用审批签名密钥，至少 32 个字符。 */
      TOOL_APPROVAL_SECRET: z.string().min(32).optional(),
      /** 是否优先使用国内域名访问 Jina 服务。 */
      JINA_USE_CN_DOMAINS: z.enum(['true', 'false']).optional(),
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
