import { NextResponse } from 'next/server'

import { UserSkillModel } from '@pure/database/models/userSkill'
import { withAuth } from '@/libs/auth/get-session-user'

import { toPublicUserSkill } from './publicSkill'

/**
 * GET /api/user/skills
 * 列出当前用户已安装的社区技能（不含文件正文）
 */
export const GET = withAuth(async (_request, { userId }) => {
  try {
    const items = await new UserSkillModel(userId).list()
    return NextResponse.json(items.map(toPublicUserSkill))
  } catch (error) {
    console.error('[api/user/skills] GET failed:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
