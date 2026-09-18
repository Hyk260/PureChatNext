import { NextResponse } from 'next/server'

import { jsonError } from '@/libs/auth/get-session-user'
import { SkillCatalogNotFoundError, SkillSourceUnavailableError, getCommunitySkillReadme } from '@/server/services/userSkill'

type RouteContext = {
  params: Promise<{ identifier: string }>
}

/**
 * GET /api/community/skills/[identifier]/readme
 * 返回 catalog 技能的 SKILL.md：优先 sync 快照，未命中再拉 GitHub。不写入对象存储。
 */
export async function GET(_request: Request, context: RouteContext) {
  const { identifier } = await context.params
  if (!identifier) return jsonError('Missing identifier')

  try {
    const markdown = await getCommunitySkillReadme(decodeURIComponent(identifier))
    return NextResponse.json({ markdown })
  } catch (error) {
    if (error instanceof SkillCatalogNotFoundError) {
      return jsonError('Skill readme not found', 404)
    }
    if (error instanceof SkillSourceUnavailableError) {
      return jsonError(error.message, 502)
    }
    console.error('[api/community/skills/readme] GET failed:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
