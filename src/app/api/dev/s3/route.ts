import { NextResponse } from 'next/server'

import { FileS3 } from '@/server/modules/S3'

const fileS3 = new FileS3()
const DEV_S3_PREFIX = 'dev/'

// —— Helpers ——

const badRequest = (error: string) => {
  return NextResponse.json({ error, success: false }, { status: 400 })
}

const ok = (data: unknown) => {
  return NextResponse.json({ data, success: true }, { status: 200 })
}

const serverError = (error: string) => {
  return NextResponse.json({ error, success: false }, { status: 500 })
}

const getAction = (searchParams: URLSearchParams) => {
  return searchParams.get('action') ?? ''
}

/** 测试页面专用对象前缀，避免污染正式资源目录。 */
const toDevKey = (key: string) => {
  const normalized = key.replace(/^\/+/, '')
  return normalized.startsWith(DEV_S3_PREFIX) ? normalized : `${DEV_S3_PREFIX}${normalized}`
}

const toDevPrefix = (prefix: string | null) => toDevKey(prefix?.trim() || '')

/**
 * S3 测试 API（仅开发环境）
 * POST /api/dev/s3
 * - action=uploadFile      (multipart/form-data, field "file")
 * - action=uploadText      (JSON: { key, content })
 * - action=uploadBuffer    (JSON: { key, content, contentType? })
 */
export const POST = async (req: Request) => {
  try {
    const url = new URL(req.url)
    const action = getAction(url.searchParams)

    if (action === 'uploadFile') {
      const formData = await req.formData()
      const file = formData.get('file')

      if (!file || !(file instanceof File)) {
        return badRequest('Missing or invalid file field')
      }

      const key = toDevKey((formData.get('key') as string) || file.name)
      const buffer = Buffer.from(await file.arrayBuffer())
      const contentType = file.type || undefined

      await fileS3.uploadBuffer(key, buffer, contentType)

      return ok({ key, size: buffer.length, contentType })
    }

    if (action === 'uploadText') {
      const body = await req.json()
      const key = body.key ? toDevKey(body.key as string) : undefined
      const content = body.content as string | undefined

      if (!key || content === undefined) {
        return badRequest('Missing "key" or "content"')
      }

      await fileS3.uploadContent(key, content)

      return ok({ key, size: Buffer.byteLength(content) })
    }

    if (action === 'uploadBuffer') {
      const body = await req.json()
      const key = body.key ? toDevKey(body.key as string) : undefined
      const content = body.content as string | undefined
      const contentType = body.contentType as string | undefined

      if (!key || content === undefined) {
        return badRequest('Missing "key" or "content"')
      }

      const buffer = Buffer.from(content, 'utf-8')
      await fileS3.uploadBuffer(key, buffer, contentType)

      return ok({ key, size: buffer.length, contentType })
    }

    if (action === 'preSignedUpload') {
      const body = await req.json()
      const key = body.key ? toDevKey(body.key as string) : undefined

      if (!key) {
        return badRequest('Missing "key"')
      }

      const result = await fileS3.createPreSignedUpload(key)

      return ok({ key, ...result })
    }

    return badRequest(`Unknown action: ${action}`)
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Unknown error')
  }
}

/**
 * S3 测试 API（仅开发环境）
 * GET /api/dev/s3
 * - action=list&prefix=xxx
 * - action=info&key=xxx
 * - action=download&key=xxx          (presigned URL for preview)
 * - action=downloadUrl&key=xxx&expiresIn=xxx
 */
export const GET = async (req: Request) => {
  try {
    const url = new URL(req.url)
    const action = getAction(url.searchParams)

    if (action === 'list') {
      const prefix = toDevPrefix(url.searchParams.get('prefix'))
      const files = await fileS3.listFiles(prefix)

      return ok(files)
    }

    if (action === 'info') {
      const keyParam = url.searchParams.get('key')
      const key = keyParam ? toDevKey(keyParam) : null

      if (!key) {
        return badRequest('Missing "key"')
      }

      const metadata = await fileS3.getFileMetadata(key)

      return ok({ key, ...metadata })
    }

    if (action === 'download' || action === 'downloadUrl') {
      const keyParam = url.searchParams.get('key')
      const key = keyParam ? toDevKey(keyParam) : null

      if (!key) {
        return badRequest('Missing "key"')
      }

      const expiresInRaw = url.searchParams.get('expiresIn')
      const expiresIn = expiresInRaw ? parseInt(expiresInRaw, 10) : undefined
      const downloadUrl = await fileS3.createPreSignedUrlForPreview(key, expiresIn)

      return ok({ key, downloadUrl, expiresIn: expiresIn ?? 7200 })
    }

    return badRequest(`Unknown action: ${action}`)
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Unknown error')
  }
}

/**
 * S3 测试 API（仅开发环境）
 * DELETE /api/dev/s3
 * - action=deleteOne&key=xxx
 * - action=deleteMany  (JSON body: { keys: string[] })
 */
export const DELETE = async (req: Request) => {
  try {
    const url = new URL(req.url)
    const action = getAction(url.searchParams)

    if (action === 'deleteOne') {
      const keyParam = url.searchParams.get('key')
      const key = keyParam ? toDevKey(keyParam) : null

      if (!key) {
        return badRequest('Missing "key"')
      }

      await fileS3.deleteFile(key)

      return ok({ key, deleted: true })
    }

    if (action === 'deleteMany') {
      const body = await req.json()
      const keys = Array.isArray(body.keys) ? body.keys.map((key: unknown) => toDevKey(String(key))) : undefined

      if (!keys || !Array.isArray(keys) || keys.length === 0) {
        return badRequest('Missing or invalid "keys" array')
      }

      await fileS3.deleteFiles(keys)

      return ok({ keys, deleted: true })
    }

    return badRequest(`Unknown action: ${action}`)
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Unknown error')
  }
}

/**
 * S3 测试 API（仅开发环境）
 * PUT /api/dev/s3
 * - action=rename  (JSON body: { oldKey, newKey })
 */
export const PUT = async (req: Request) => {
  try {
    const url = new URL(req.url)
    const action = getAction(url.searchParams)

    if (action === 'rename') {
      const body = await req.json()
      const oldKey = body.oldKey ? toDevKey(body.oldKey as string) : undefined
      const newKey = body.newKey ? toDevKey(body.newKey as string) : undefined

      if (!oldKey || !newKey) {
        return badRequest('Missing "oldKey" or "newKey"')
      }

      await fileS3.copyObject(oldKey, newKey)
      await fileS3.deleteFile(oldKey)

      return ok({ oldKey, newKey, renamed: true })
    }

    return badRequest(`Unknown action: ${action}`)
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Unknown error')
  }
}
