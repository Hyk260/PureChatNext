export interface GoogleSearchParameters {
  c2coff?: number
  cx: string
  dateRestrict?: string
  exactTerms?: string
  excludeTerms?: string
  fileType?: string
  filter?: string
  gl?: string
  highRange?: string
  hl?: string
  hq?: string
  imgColorType?: string
  imgDominantColor?: string
  imgSize?: string
  imgType?: string
  key: string
  linkSite?: string
  lowRange?: string
  lr?: string
  num?: number
  orTerms?: string
  q: string
  rights?: string
  safe?: string
  searchType?: string
  siteSearch?: string
  siteSearchFilter?: string
  sort?: string
  start?: string
}

interface GoogleItems {
  displayLink?: string
  formattedUrl?: string
  htmlFormattedUrl?: string
  htmlSnippet?: string
  htmlTitle?: string
  kind?: string
  link: string
  pagemap?: Record<string, unknown>
  snippet: string
  title: string
}

export interface GoogleResponse {
  context?: Record<string, unknown>
  items: GoogleItems[]
  kind?: string
  queries?: Record<string, unknown>
  searchInformation?: Record<string, unknown>
  url?: Record<string, unknown>
}
