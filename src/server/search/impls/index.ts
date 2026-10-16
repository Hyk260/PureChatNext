import { AnspireImpl } from './anspire'
import { BochaImpl } from './bocha'
import { BraveImpl } from './brave'
import { ExaImpl } from './exa'
import { FirecrawlImpl } from './firecrawl'
import { GoogleImpl } from './google'
import { JinaImpl } from './jina'
import { KagiImpl } from './kagi'
import { Search1APIImpl } from './search1api'
import { SearXNGImpl } from './searxng'
import { TavilyImpl } from './tavily'
import type { SearchProviderOptions, SearchServiceImpl } from './type'

/**
 * Available search service implementations
 */
export enum SearchImplType {
  Anspire = 'anspire',
  Bocha = 'bocha',
  Brave = 'brave',
  Exa = 'exa',
  Firecrawl = 'firecrawl',
  Google = 'google',
  Jina = 'jina',
  Kagi = 'kagi',
  Search1API = 'search1api',
  SearXNG = 'searxng',
  Tavily = 'tavily',
}

export const SEARCH_IMPL_TYPES = Object.values(SearchImplType)

export const isSearchImplType = (value: string): value is SearchImplType => {
  return SEARCH_IMPL_TYPES.includes(value as SearchImplType)
}

/**
 * Create a search service implementation instance
 */
export const createSearchServiceImpl = (
  type: SearchImplType = SearchImplType.SearXNG,
  options: SearchProviderOptions = {}
): SearchServiceImpl => {
  switch (type) {
    case SearchImplType.Anspire: {
      return new AnspireImpl(options)
    }

    case SearchImplType.Bocha: {
      return new BochaImpl(options)
    }

    case SearchImplType.Brave: {
      return new BraveImpl(options)
    }

    case SearchImplType.Exa: {
      return new ExaImpl(options)
    }

    case SearchImplType.Firecrawl: {
      return new FirecrawlImpl(options)
    }

    case SearchImplType.Google: {
      return new GoogleImpl(options)
    }

    case SearchImplType.Jina: {
      return new JinaImpl(options)
    }

    case SearchImplType.Kagi: {
      return new KagiImpl(options)
    }

    case SearchImplType.SearXNG: {
      return new SearXNGImpl(options)
    }

    case SearchImplType.Tavily: {
      return new TavilyImpl(options)
    }

    default: {
      return new Search1APIImpl(options)
    }
  }
}

export type { SearchServiceImpl } from './type'
