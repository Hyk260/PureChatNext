import { NextResponse } from 'next/server'

import { FileModel } from '@pure/database/models/file'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { deleteS3ObjectsByUrls } from '@/server/modules/S3/cleanup'
import { resolveFileAccessUrl } from '@/server/modules/S3/url'

export const GET = withAuth(async (_request, { params, userId }) => {
  const { id } = await params
  const file = await new FileModel(userId).findById(id)
  if (!file) return jsonError('File not found', 404)

  return NextResponse.json({
    ...file,
    url: resolveFileAccessUrl(file.id, file.url),
  })
})

export const PATCH = withAuth(async (request, { params, userId }) => {
  const { id } = await params
  const body = await request.json()
  const file = await new FileModel(userId).update(id, body)
  if (!file) return jsonError('File not found', 404)

  return NextResponse.json({
    ...file,
    url: resolveFileAccessUrl(file.id, file.url),
  })
})

export const DELETE = withAuth(async (_request, { params, userId }) => {
  const { id } = await params
  const file = await new FileModel(userId).delete(id)
  if (!file) return jsonError('File not found', 404)

  const fileModel = new FileModel(userId)
  if (!(await fileModel.hasUrlReference(file.url))) {
    try {
      await deleteS3ObjectsByUrls([file.url])
    } catch (error) {
      console.error('[resources/files/delete] S3 清理失败：', error)
      return NextResponse.json(
        { databaseDeleted: true, error: '文件记录已删除，但对象存储清理失败，请检查 S3 配置后手动清理。' },
        { status: 502 }
      )
    }
  }

  return NextResponse.json({ success: true })
})
