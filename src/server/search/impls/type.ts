import type { SearchParams, UniformSearchResponse } from '@pure/types'

/**
 * Search service implementation interface
 */
export interface SearchServiceImpl {
  /**
   * Query for search results
   */
  query: (query: string, params?: SearchParams) => Promise<UniformSearchResponse>
}

export type SearchProviderOptions = {
  apiKey?: string
  baseURL?: string
  engineId?: string
  basicAuthUsername?: string
  basicAuthPassword?: string
  fetch?: typeof fetch
}
