/**
 * Sync community agents from the public agents-index CDN (npmmirror).
 * Data source: the public community agents index package（仅作社区内容索引）。
 *
 * Usage: pnpm agents:sync
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mapDetailToDiscoverFields } from './map-community-agent-detail'
import type { DetailAgent, DiscoverAgentExample } from './map-community-agent-detail'

const AGENTS_INDEX_URL = 'https://registry.npmmirror.com/@lobehub/agents-index/v1/files/public'
const LOCALE = 'zh-CN'
const PER_CATEGORY = 30
const CONCURRENCY = 10

const BUSINESS_CATEGORIES = [
  'academic',
  'career',
  'copywriting',
  'design',
  'education',
  'emotions',
  'entertainment',
  'games',
  'general',
  'life',
  'marketing',
  'office',
  'programming',
  'translation',
] as const

type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number]

type IndexAgent = {
  author?: string
  createdAt?: string
  identifier: string
  knowledgeCount?: number
  meta?: {
    avatar?: string
    backgroundColor?: string
    category?: string
    description?: string
    tags?: string[]
    title?: string
  }
  pluginCount?: number
  tokenUsage?: number
}

type DiscoverAgentItem = {
  author: string
  avatar: string
  backgroundColor?: string
  category: BusinessCategory
  createdAt: string
  description: string
  examples?: DiscoverAgentExample[]
  identifier: string
  knowledgeCount?: number
  openingMessage?: string
  openingQuestions?: string[]
  pluginCount?: number
  summary?: string
  systemRole: string
  tags?: string[]
  title: string
  tokenUsage?: number
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '../src/const/community/agents.data.ts')

const isBusinessCategory = (value: string | undefined): value is BusinessCategory =>
  Boolean(value && (BUSINESS_CATEGORIES as readonly string[]).includes(value))

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await mapper(items[index], index)
    }
  })

  await Promise.all(workers)
  return results
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as T
}

async function fetchAgentDetail(identifier: string): Promise<DetailAgent | null> {
  const url = `${AGENTS_INDEX_URL}/${identifier}.${LOCALE}.json`
  try {
    return await fetchJson<DetailAgent>(url)
  } catch (error) {
    console.warn(`[agents:sync] detail failed for ${identifier}:`, error)
    return null
  }
}

async function main() {
  console.log('[agents:sync] fetching index…')
  const index = await fetchJson<{ agents: IndexAgent[] }>(`${AGENTS_INDEX_URL}/index.${LOCALE}.json`)
  const agents = index.agents ?? []
  console.log(`[agents:sync] index size: ${agents.length}`)

  const selected: IndexAgent[] = []
  const counts: Record<string, number> = {}

  for (const category of BUSINESS_CATEGORIES) {
    const group = agents.filter((agent) => agent.meta?.category === category).slice(0, PER_CATEGORY)
    counts[category] = group.length
    selected.push(...group)
  }

  console.log('[agents:sync] per category:', counts)
  console.log(`[agents:sync] fetching ${selected.length} details (concurrency=${CONCURRENCY})…`)

  const items = await mapPool(selected, CONCURRENCY, async (agent) => {
    const category = agent.meta?.category
    if (!isBusinessCategory(category)) {
      throw new Error(`unexpected category for ${agent.identifier}: ${category}`)
    }

    const detail = await fetchAgentDetail(agent.identifier)
    const detailFields = mapDetailToDiscoverFields(detail ?? {})
    const indexBg = agent.meta?.backgroundColor
    const indexTags = agent.meta?.tags?.filter((tag) => tag.trim().length > 0)

    const item: DiscoverAgentItem = {
      author: agent.author ?? 'unknown',
      avatar: agent.meta?.avatar ?? detail?.meta?.avatar ?? '🤖',
      category,
      createdAt: agent.createdAt ?? '',
      description: agent.meta?.description ?? detail?.meta?.description ?? '',
      identifier: agent.identifier,
      title: agent.meta?.title ?? detail?.meta?.title ?? agent.identifier,
      ...detailFields,
      ...(indexBg ? { backgroundColor: indexBg } : {}),
      ...(indexTags && indexTags.length > 0 && !detailFields.tags ? { tags: indexTags } : {}),
    }

    if (typeof agent.knowledgeCount === 'number') item.knowledgeCount = agent.knowledgeCount
    if (typeof agent.pluginCount === 'number') item.pluginCount = agent.pluginCount
    if (typeof agent.tokenUsage === 'number') item.tokenUsage = agent.tokenUsage

    return item
  })

  const missingRole = items.filter((item) => !item.systemRole).length
  if (missingRole > 0) {
    console.warn(`[agents:sync] ${missingRole} agents missing systemRole`)
  }

  const header = [
    '/**',
    ' * Auto-generated by `pnpm agents:sync` from public agents-index CDN.',
    ' * Do not edit manually.',
    ' */',
    "import type { DiscoverAgentItem } from '@/features/community/types'",
    '',
    'export const COMMUNITY_AGENTS_DATA =',
  ].join('\n')

  const body = JSON.stringify(items, null, 2)
  // String enum categories from JSON are asserted — TS does not widen '"academic"' to AssistantCategory.
  const content = `${header} ${body} as DiscoverAgentItem[]\n`

  writeFileSync(OUT_PATH, content, 'utf8')
  console.log(`[agents:sync] wrote ${items.length} agents → ${OUT_PATH}`)
}

main().catch((error) => {
  console.error('[agents:sync] failed:', error)
  process.exit(1)
})
