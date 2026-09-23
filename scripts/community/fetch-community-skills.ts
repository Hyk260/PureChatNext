/**
 * Sync community skills from the public skills marketplace CLI.
 *
 * Usage:
 *   pnpm skills:sync
 *   bun scripts/community/fetch-community-skills.ts --readmes-only
 */
import { execFile } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { mapMarketSkillToDiscoverItem, SKILL_MARKET_CATEGORIES } from '../map-community-skill'
import type { DiscoverSkillItem, MarketSkillListItem } from '../map-community-skill'
import { GitHub, GitHubNotFoundError, GitHubParseError } from '../../src/server/modules/GitHub'
import { skillReadmeRepoPath } from '../../src/server/modules/GitHub/skillFiles'

const execFileAsync = promisify(execFile)

const LOCALE = 'zh-CN'
const PER_CATEGORY = 15
const README_CONCURRENCY = 8

type MarketSearchResponse = {
  items?: MarketSkillListItem[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, 'generated/skills.data.ts')
const README_OUT_PATH = join(__dirname, 'generated/skills.readme.data.json')

const github = new GitHub()

const parseCliJson = (stdout: string): MarketSearchResponse => {
  const start = stdout.indexOf('{')
  const end = stdout.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error(`market-cli stdout is not JSON: ${stdout.slice(0, 200)}`)
  }
  return JSON.parse(stdout.slice(start, end + 1)) as MarketSearchResponse
}

const skillSourceUrl = (skill: DiscoverSkillItem) => skill.homepage?.trim() || skill.github?.url?.trim() || null

async function mapPool<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await mapper(items[index])
    }
  })

  await Promise.all(workers)
  return results
}

const searchCategory = async (category: string): Promise<MarketSkillListItem[]> => {
  const { stdout } = await execFileAsync(
    'npx',
    [
      '-y',
      '@lobehub/market-cli',
      'skills',
      'search',
      '--category',
      category,
      '--sort',
      'installCount',
      '--order',
      'desc',
      '--page',
      '1',
      '--page-size',
      String(PER_CATEGORY),
      '--locale',
      LOCALE,
      '--output',
      'json',
    ],
    { maxBuffer: 20 * 1024 * 1024 }
  )

  return parseCliJson(stdout).items ?? []
}

const fetchMarketSkills = async () => {
  console.log('[skills:sync] fetching marketplace list…')
  const selected: DiscoverSkillItem[] = []
  const seen = new Set<string>()
  const counts: Record<string, number> = {}

  for (const category of SKILL_MARKET_CATEGORIES) {
    const items = await searchCategory(category)
    let kept = 0

    for (const item of items) {
      const mapped = mapMarketSkillToDiscoverItem({ ...item, category: item.category ?? category })
      if (!mapped || mapped.category !== category) continue
      if (seen.has(mapped.identifier)) continue
      seen.add(mapped.identifier)
      selected.push(mapped)
      kept += 1
    }

    counts[category] = kept
    console.log(`[skills:sync] ${category}: ${kept}/${items.length}`)
  }

  return { counts, selected }
}

const writeSkillsData = (selected: DiscoverSkillItem[]) => {
  const header = [
    '/**',
    ' * Draft from `pnpm skills:sync`. The next sync overwrites this file.',
    ' * Copy chosen entries into src/const/community/skills.data.ts.',
    ' */',
    "import type { DiscoverSkillItem } from '@/features/community/types'",
    '',
    'export const COMMUNITY_SKILLS_DATA =',
  ].join('\n')

  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, `${header} ${JSON.stringify(selected, null, 2)} as DiscoverSkillItem[]\n`, 'utf8')
  console.log(`[skills:sync] wrote ${selected.length} skills → ${OUT_PATH}`)
}

const writeReadmeData = (readmes: Record<string, string>) => {
  mkdirSync(dirname(README_OUT_PATH), { recursive: true })
  writeFileSync(README_OUT_PATH, `${JSON.stringify(readmes)}\n`, 'utf8')
  console.log(`[skills:sync] wrote ${Object.keys(readmes).length} readmes → ${README_OUT_PATH}`)
}

type SkillReadmeFetch = { markdown: string; status: 'ok' } | { status: 'missing' } | { status: 'failed' }

/** Missing or unparsable GitHub source cannot be installed; transient errors stay in the catalog. */
const fetchSkillReadme = async (skill: DiscoverSkillItem): Promise<SkillReadmeFetch> => {
  const sourceUrl = skillSourceUrl(skill)
  if (!sourceUrl) return { status: 'missing' }

  try {
    const repo = github.parseRepoUrl(sourceUrl)
    const markdown = await github.downloadRawFile({ ...repo, filePath: skillReadmeRepoPath(repo) })
    return { markdown, status: 'ok' }
  } catch (error) {
    if (error instanceof GitHubNotFoundError || error instanceof GitHubParseError) {
      return { status: 'missing' }
    }
    const detail = error instanceof Error ? error.message : error
    console.warn(`[skills:sync] readme skipped ${skill.identifier}: ${detail}`)
    return { status: 'failed' }
  }
}

const fetchReadmes = async (skills: DiscoverSkillItem[], dropMissing: boolean) => {
  console.log(`[skills:sync] fetching ${skills.length} SKILL.md (concurrency=${README_CONCURRENCY})…`)
  let done = 0
  const results = await mapPool(skills, README_CONCURRENCY, async (skill) => {
    const result = await fetchSkillReadme(skill)
    done += 1
    if (done % 40 === 0) console.log(`[skills:sync] readmes ${done}/${skills.length}`)
    return result
  })

  const readmes: Record<string, string> = {}
  const kept: DiscoverSkillItem[] = []
  let dropped = 0

  for (const [index, skill] of skills.entries()) {
    const result = results[index]
    if (result.status === 'missing' && dropMissing) {
      dropped += 1
      console.warn(`[skills:sync] drop ${skill.identifier}: source SKILL.md missing`)
      continue
    }
    if (result.status === 'missing') {
      console.warn(`[skills:sync] readme skipped ${skill.identifier}: SKILL.md not found`)
    }
    kept.push(skill)
    if (result.status === 'ok') readmes[skill.identifier] = result.markdown
  }

  console.log(`[skills:sync] readmes ${Object.keys(readmes).length}/${skills.length}, dropped ${dropped}`)
  return { kept, readmes }
}

async function main() {
  const readmesOnly = process.argv.includes('--readmes-only')
  let selected: DiscoverSkillItem[]

  if (readmesOnly) {
    const { COMMUNITY_SKILLS_DATA } = await import('../../src/const/community/skills.data')
    selected = COMMUNITY_SKILLS_DATA
    console.log(`[skills:sync] --readmes-only, using ${selected.length} existing skills`)
    writeReadmeData((await fetchReadmes(selected, false)).readmes)
    return
  }

  const fetched = await fetchMarketSkills()
  console.log('[skills:sync] per category:', fetched.counts)
  const { kept, readmes } = await fetchReadmes(fetched.selected, true)
  writeSkillsData(kept)
  writeReadmeData(readmes)
}

main().catch((error) => {
  console.error('[skills:sync] failed:', error)
  process.exit(1)
})
