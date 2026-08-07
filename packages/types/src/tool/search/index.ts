export interface SearchParams {
  searchCategories?: string[]
  searchEngines?: string[]
  searchTimeRange?: string
}

export interface SearchQuery extends SearchParams {
  query: string
}

export const SEARCH_SEARXNG_NOT_CONFIG = 'SearXNG is not configured'

export interface SearchContent {
  content?: string
  img_src?: string
  publishedDate?: string | null
  thumbnail?: string | null
  title: string
  url: string
}

export interface UniformSearchResult {
  category?: string
  content: string
  engines: string[]
  /**
   * Used for video results
   */
  iframeSrc?: string
  imgSrc?: string
  parsedUrl: string
  publishedDate?: string
  score: number
  thumbnail?: string
  title: string
  url: string
}

export interface UniformSearchResponse {
  costTime: number
  errorDetail?: string
  /**
   * 实际返回结果的搜索服务商（如 searxng / tavily）
   */
  provider?: string
  /** Describes whether SearchService had to relax the requested filters. */
  fallback?: {
    applied: SearchParams
    level: 'all-filters-removed' | 'engine-removed' | 'none'
    requested: SearchParams
  }
  query: string
  resultNumbers: number
  results: UniformSearchResult[]
}

export type ChatWebSearchResultItem = {
  content: string
  publishedDate?: string
  title: string
  url: string
}

export type ChatWebSearchToolResult =
  | {
      query: string
      results: ChatWebSearchResultItem[]
      success: true
    }
  | {
      error: string
      query: string
      results: []
      success: false
    }
