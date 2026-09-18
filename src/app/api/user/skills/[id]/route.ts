import { NextResponse } from 'next/server'

import { UserSkillModel } from '@pure/database/models/userSkill'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { uninstallCommunitySkill } from '@/server/services/userSkill'

import { toPublicUserSkill } from '../publicSkill'

/**
 * GET /api/user/skills/[id]
 * 技能详情与文件列表（路径 / 大小 / mime，不含正文）
 */
export const GET = withAuth(async (_request, { params, userId }) => {
  const { id } = await params
  const model = new UserSkillModel(userId)
  const skill = await model.findById(id)
  if (!skill) return jsonError('Skill not found', 404)

  const files = await model.listFiles(id)
  return NextResponse.json({
    ...toPublicUserSkill(skill),
    files: files.map((file) => ({
      fileType: file.fileType,
      path: file.path,
      size: file.size,
    })),
  })
})

/**
 * DELETE /api/user/skills/[id]
 * 卸载技能：删除 S3 对象与数据库行
 */
export const DELETE = withAuth(async (_request, { params, userId }) => {
  const { id } = await params
  try {
    const deleted = await uninstallCommunitySkill(userId, id)
    if (!deleted) return jsonError('Skill not found', 404)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[api/user/skills] DELETE failed:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
