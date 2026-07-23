import { browserless } from './browserless'
import { exa } from './exa'
import { firecrawl } from './firecrawl'
import { jina } from './jina'
import { naive } from './naive'
import { search1api } from './search1api'
import { tavily } from './tavily'

/** Registered crawl backends for @pure/web-crawler. */
export const crawlImpls = {
  browserless,
  exa,
  firecrawl,
  jina,
  naive,
  search1api,
  tavily,
}

export type CrawlImplType = keyof typeof crawlImpls
