import { createHash } from 'node:crypto'

import debug from 'debug'
import { NextResponse } from 'next/server'

import { FileModel, FileStorageQuotaExceededError } from '@pure/database/models/file'
import { fileStorageLimitBytes } from '@/envs/file'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { FileS3 } from '@/server/modules/S3'
import { isS3Configured } from '@/server/modules/S3/config'
import { buildPublicS3Url, resolveFileAccessUrl } from '@/server/modules/S3/url'

const log = debug('file:upload')

const quotaExceededResponse = (usedBytes: number, requestedBytes: number) =>
  NextResponse.json(
    {
      code: 'FILE_STORAGE_QUOTA_EXCEEDED',
      error: '文件存储空间不足',
      limitBytes: fileStorageLimitBytes,
      requestedBytes,
      usedBytes,
    },
    { status: 413 }
  )

/**
 * POST /api/resources/upload
 * 上传文件到 S3 并写入文件记录
 * @param request - multipart/form-data，字段 `file`；可选 `knowledgeBaseId` / `parentId`
 */
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

  const model = new FileModel(userId)
  let usedBytes: number
  try {
    usedBytes = await model.getStorageUsage()
  } catch (error) {
    log('storage usage query failed: %O', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  if (usedBytes + file.size > fileStorageLimitBytes) {
    return quotaExceededResponse(usedBytes, file.size)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const fileHash = createHash('sha256').update(buffer).digest('hex')
  const key = `resources/${userId}/${Date.now()}-${file.name}`
  const fileS3 = new FileS3()
  const url = buildPublicS3Url(key)
  let uploaded = false
  let committed = false

  try {
    await fileS3.uploadMedia(key, buffer)
    uploaded = true

    const result = await model.createWithinStorageLimit(
      {
        fileHash,
        fileType: file.type || 'application/octet-stream',
        knowledgeBaseId,
        name: file.name,
        parentId: parentId || null,
        size: file.size,
        url,
      },
      fileStorageLimitBytes,
      true
    )
    committed = true

    const created = await model.findById(result.id)
    if (!created) {
      return NextResponse.json({ error: 'Upload succeeded but file not found' }, { status: 500 })
    }

    return NextResponse.json({
      ...created,
      url: resolveFileAccessUrl(created.id, created.url),
    })
  } catch (error) {
    if (uploaded && !committed) {
      try {
        await fileS3.deleteFile(key)
      } catch (cleanupError) {
        log('orphan cleanup failed for %s: %O', key, cleanupError)
      }
    }

    if (error instanceof FileStorageQuotaExceededError) {
      return quotaExceededResponse(error.usedBytes, error.requestedBytes)
    }

    log('POST failed: %O', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
})
