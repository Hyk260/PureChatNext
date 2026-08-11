import { NextResponse } from 'next/server'
import { z } from 'zod'

import { FileModel } from '@pure/database/models/file'
import { KnowledgeRepo } from '@pure/database/repositories/knowledge'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { deleteS3ObjectsByUrls } from '@/server/modules/S3/cleanup'

const batchSchema = z.object({
  action: z.enum(['delete']),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        sourceType: z.enum(['file', 'document']),
      })
    )
    .min(1),
})

export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json()
  const parsed = batchSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  if (parsed.data.action === 'delete') {
    const deletedFiles = await new KnowledgeRepo(userId).deleteMany(parsed.data.items)
    const fileModel = new FileModel(userId)
    const cleanupUrls: string[] = []
    for (const file of deletedFiles) {
      if (!(await fileModel.hasUrlReference(file.url))) cleanupUrls.push(file.url)
    }
    if (cleanupUrls.length > 0) {
      try {
        await deleteS3ObjectsByUrls(cleanupUrls)
      } catch (error) {
        console.error('[resources/files/batch] S3 清理失败：', error)
        return NextResponse.json(
          {
            databaseDeleted: parsed.data.items.length,
            error: '文件记录已删除，但部分对象存储清理失败，请检查 S3 配置后手动清理。',
          },
          { status: 502 }
        )
      }
    }
    return NextResponse.json({ deleted: parsed.data.items.length })
  }

  return jsonError('Unsupported action')
})
