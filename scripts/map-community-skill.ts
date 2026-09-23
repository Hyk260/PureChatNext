export const SKILL_MARKET_CATEGORIES = [
  'coding-agents-ides',
  'web-frontend-development',
  'devops-cloud',
  'search-research',
  'browser-automation',
  'productivity-tasks',
  'ai-llms',
  'cli-utilities',
  'git-github',
  'image-video-generation',
  'communication',
  'transportation',
  'pdf-documents',
  'marketing-sales',
  'health-fitness',
  'media-streaming',
  'notes-pkm',
  'calendar-scheduling',
  'shopping-ecommerce',
  'security-passwords',
  'personal-development',
  'speech-transcription',
  'apple-apps-services',
  'smart-home-iot',
  'gaming',
  'clawdbot-tools',
  'self-hosted-automation',
  'ios-macos-development',
  'moltbook',
  'data-analytics',
  'finance',
  'agent-to-agent-protocols',
] as const

export type SkillMarketCategory = (typeof SKILL_MARKET_CATEGORIES)[number]

export type DiscoverSkillItem = {
  author: string
  category: SkillMarketCategory
  description: string
  github?: { stars?: number; url?: string }
  homepage?: string
  icon?: string
  identifier: string
  isFeatured?: boolean
  license?: string
  name: string
  resourcesCount?: number
  tags?: string[]
  updatedAt: string
  version?: string
}

type MarketGithub = {
  forks?: number
  stars?: number
  url?: string
  watchers?: number
}

export type MarketSkillListItem = {
  author?: string
  category?: string
  commentCount?: number
  createdAt?: string
  description?: string
  github?: MarketGithub
  homepage?: string
  icon?: string
  identifier?: string
  installCount?: number
  isFeatured?: boolean
  license?: string
  name?: string
  ratingAvg?: number
  resourcesCount?: number
  tags?: string[]
  updatedAt?: string
  version?: string
}

export const isSkillMarketCategory = (value: string | undefined): value is SkillMarketCategory =>
  Boolean(value && (SKILL_MARKET_CATEGORIES as readonly string[]).includes(value))

const asFiniteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const asNonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined

const mapGithub = (github: MarketGithub | undefined): DiscoverSkillItem['github'] | undefined => {
  if (!github) return undefined

  const url = asNonEmptyString(github.url)
  const mapped = {
    ...(typeof github.stars === 'number' ? { stars: github.stars } : {}),
    ...(url ? { url } : {}),
  }

  return Object.keys(mapped).length > 0 ? mapped : undefined
}

/** Map a marketplace list item into the community skill snapshot. */
export function mapMarketSkillToDiscoverItem(item: MarketSkillListItem): DiscoverSkillItem | null {
  const identifier = asNonEmptyString(item.identifier)
  const name = asNonEmptyString(item.name)
  const description = asNonEmptyString(item.description)
  const updatedAt = asNonEmptyString(item.updatedAt)
  if (!identifier || !name || !description || !updatedAt) return null
  if (!isSkillMarketCategory(item.category)) return null

  const tags = item.tags?.map((tag) => tag.trim()).filter((tag) => tag.length > 0)
  const github = mapGithub(item.github)
  const homepage = asNonEmptyString(item.homepage)
  const icon = asNonEmptyString(item.icon)
  const license = asNonEmptyString(item.license)
  const version = asNonEmptyString(item.version)
  const resourcesCount = asFiniteNumber(item.resourcesCount)

  return {
    author: asNonEmptyString(item.author) ?? 'unknown',
    category: item.category,
    description,
    identifier,
    name,
    updatedAt,
    ...(github ? { github } : {}),
    ...(homepage ? { homepage } : {}),
    ...(icon ? { icon } : {}),
    ...(item.isFeatured ? { isFeatured: true } : {}),
    ...(license ? { license } : {}),
    ...(resourcesCount !== undefined ? { resourcesCount } : {}),
    ...(tags && tags.length > 0 ? { tags } : {}),
    ...(version ? { version } : {}),
  }
}
