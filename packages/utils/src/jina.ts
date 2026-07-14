const DEFAULT_JINA_READER_BASE_URL = 'https://r.jina.ai'
const DEFAULT_JINA_SEARCH_BASE_URL = 'https://s.jina.ai'
const CN_JINA_READER_BASE_URL = 'https://r.jinaai.cn'
const CN_JINA_SEARCH_BASE_URL = 'https://s.jinaai.cn'

/**
 * Prefer passing `useCn` from `toolsEnv.JINA_USE_CN_DOMAINS === 'true'`
 * so env validation stays the single source of truth.
 */
export const isJinaCnDomainsEnabled = (useCn?: boolean) =>
  useCn ?? process.env.JINA_USE_CN_DOMAINS?.trim().toLowerCase() === 'true'

export const getJinaReaderBaseUrl = (useCn?: boolean) =>
  isJinaCnDomainsEnabled(useCn) ? CN_JINA_READER_BASE_URL : DEFAULT_JINA_READER_BASE_URL

export const getJinaSearchBaseUrl = (useCn?: boolean) =>
  isJinaCnDomainsEnabled(useCn) ? CN_JINA_SEARCH_BASE_URL : DEFAULT_JINA_SEARCH_BASE_URL
