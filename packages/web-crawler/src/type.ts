import { type CrawlSuccessResult } from '@pure/types'

export type { CrawlErrorResult, CrawlSuccessResult, CrawlUniformResult } from '@pure/types'

export interface FilterOptions {
  // Whether to enable Readability
  enableReadability?: boolean

  pureText?: boolean
}

type CrawlImplParams<T> = T & {
  filterOptions: FilterOptions
}

export type CrawlImpl<Params = object> = (
  url: string,
  params: CrawlImplParams<Params>
) => Promise<CrawlSuccessResult | undefined>

export interface CrawlUrlRule {
  // Content filtering configuration (optional)
  filterOptions?: FilterOptions
  /** Impl names from `crawlImpls`; invalid names are ignored at runtime. */
  impls?: string[]
  // URL matching pattern, only supports regular expressions
  urlPattern: string
  // URL transformation template (optional), performs URL conversion if provided
  urlTransform?: string
}
