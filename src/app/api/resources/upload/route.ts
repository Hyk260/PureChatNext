import { createHash } from 'node:crypto'

import { NextResponse } from 'next/server'

import { FileModel } from '@/database/models/file'
import { fileEnv } from '@/envs/file'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { FileS3 } from '@/server/modules/S3'
import { buildPublicS3Url, resolveFileAccessUrl } from '@/server/modules/S3/url'

function isS3Configured() {
  return Boolean(fileEnv.S3_ACCESS_KEY_ID && fileEnv.S3_SECRET_ACCESS_KEY && fileEnv.S3_ENDPOINT && fileEnv.S3_BUCKET)
}

export const POST = withAuth(async (request, { userId }) => {
  if (!isS3Configured()) {
    return jsonError('S3 is not configured', 503)
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const knowledgeBaseId = formData.get('knowledgeBaseId')?.toString()
  const parentId = formData.get('parentId')?.toString()

  if (!file || !(file instanceof File)) {
    return jsonError('Missing or invalid file field')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const fileHash = createHash('sha256').update(buffer).digest('hex')
  const key = `resources/${userId}/${Date.now()}-${file.name}`
  const fileS3 = new FileS3()

  await fileS3.uploadMedia(key, buffer)

  const url = buildPublicS3Url(key)
  const model = new FileModel(userId)
  try {
    const result = await model.create(
      {
        fileHash,
        fileType: file.type || 'application/octet-stream',
        knowledgeBaseId,
        name: file.name,
        parentId: parentId || null,
        size: file.size,
        url,
      },
      true
    )

    const created = await model.findById(result.id)
    if (!created) {
      return NextResponse.json({ error: 'Upload succeeded but file not found' }, { status: 500 })
    }

    return NextResponse.json({
      ...created,
      url: resolveFileAccessUrl(created.id, created.url),
    })
  } catch (error) {
    console.error('[resources/upload] POST failed:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
})
