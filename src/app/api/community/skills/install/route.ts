import { NextResponse } from 'next/server'
import { z } from 'zod'

import { UserSkillAlreadyInstalledError } from '@pure/database/models/userSkill'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { SkillPackageError } from '@/server/modules/GitHub/skillFiles'
import {
  SkillCatalogNotFoundError,
  SkillS3NotConfiguredError,
  SkillSourceUnavailableError,
  installCommunitySkill,
} from '@/server/services/userSkill'

const installSchema = z.object({
  identifier: z.string().min(1),
})

/**
 * POST /api/community/skills/install
 * 按 catalog identifier 安装技能到当前用户库（文件写入 S3）
 * @param request - JSON body `{ identifier }`
 */
export const POST = withAuth(async (request, { userId }) => {
  const parsed = installSchema.safeParse(await request.json())
  if (!parsed.success) return jsonError(parsed.error.message)

  try {
    const skill = await installCommunitySkill(userId, parsed.data.identifier)
    return NextResponse.json({
      fileCount: skill.fileCount,
      id: skill.id,
      identifier: skill.identifier,
      name: skill.name,
    })
  } catch (error) {
    if (error instanceof SkillS3NotConfiguredError) {
      return jsonError('S3 is not configured', 503)
    }
    if (error instanceof UserSkillAlreadyInstalledError) {
      return jsonError('Skill already installed', 409)
    }
    if (error instanceof SkillCatalogNotFoundError) {
      return jsonError('Skill not found', 404)
    }
    if (error instanceof SkillPackageError) {
      return jsonError(error.message, 400)
    }
    if (error instanceof SkillSourceUnavailableError) {
      return jsonError(error.message, 502)
    }
    console.error('[api/community/skills/install] POST failed:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
