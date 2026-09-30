import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { loadFile, UnsupportedFileTypeError } from '@pure/file-loaders'
import { ssrfSafeFetch } from '@pure/ssrf-safe-fetch'

import { withAdmin } from '@/libs/auth/get-session-user'
import { safeFileName } from '@/libs/utils/safeFileName'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 10_000

class ReadFileInputError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 502
  ) {
    super(message)
  }
}

/**
 * 解析文件内容（仅管理员）
 * POST /api/admin/read-file
 *
 * 支持两种入参方式：
 * 1. 上传文件: multipart/form-data, 字段名 "file"
 * 2. 传入 URL: application/json, body: { "url": "https://example.com/file.pdf" }
 */

async function downloadFromUrl(url: string): Promise<{ buffer: Buffer; filename: string }> {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new ReadFileInputError('Invalid URL', 400)
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new ReadFileInputError('Only HTTP and HTTPS URLs are supported', 400)
  }

  const response = await ssrfSafeFetch(
    parsedUrl.toString(),
    {
      redirect: 'error',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    },
    { allowIPAddressList: [], allowPrivateIPAddress: false, maxContentLength: MAX_FILE_BYTES + 1 }
  )
  if (!response.ok) {
    throw new ReadFileInputError(`Failed to download file: ${response.status} ${response.statusText}`, 502)
  }

  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_BYTES) {
    throw new ReadFileInputError('File exceeds the 10MB limit', 413)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > MAX_FILE_BYTES) {
    throw new ReadFileInputError('File exceeds the 10MB limit', 413)
  }
  const filename = safeFileName(parsedUrl.pathname.split('/').pop() || 'downloaded-file', 'downloaded-file')
  return { buffer, filename }
}

async function saveTempFile(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : ''
  const tmpPath = join(tmpdir(), `read-file-${randomUUID()}${ext}`)
  await writeFile(tmpPath, buffer)
  return tmpPath
}

export const POST = withAdmin(async (request: NextRequest) => {
  let tmpPath: string | null = null

  try {
    const contentType = request.headers.get('content-type') || ''
    let buffer: Buffer
    let filename: string

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: 'Missing or invalid "file" field' }, { status: 400 })
      }
      if (file.size > MAX_FILE_BYTES) {
        throw new ReadFileInputError('File exceeds the 10MB limit', 413)
      }
      buffer = Buffer.from(await file.arrayBuffer())
      filename = safeFileName(file.name, 'uploaded-file')
    } else if (contentType.includes('application/json')) {
      const body = await request.json()
      const url = body.url
      if (!url || typeof url !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid "url" field' }, { status: 400 })
      }
      const downloaded = await downloadFromUrl(url)
      buffer = downloaded.buffer
      filename = downloaded.filename
    } else {
      return NextResponse.json(
        { error: 'Use multipart/form-data for file upload or application/json with { "url": "..." }' },
        { status: 400 }
      )
    }

    tmpPath = await saveTempFile(buffer, filename)

    const result = await loadFile(tmpPath, { filename, source: tmpPath })

    await unlink(tmpPath).catch(() => {})

    return NextResponse.json(result)
  } catch (error) {
    if (tmpPath) {
      await unlink(tmpPath).catch(() => {})
    }

    if (error instanceof UnsupportedFileTypeError) {
      return NextResponse.json({ error: error.message }, { status: 415 })
    }
    if (error instanceof ReadFileInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
