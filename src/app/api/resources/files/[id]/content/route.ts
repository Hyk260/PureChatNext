import { FileModel } from '@pure/database/models/file'
import { withAuth } from '@/libs/auth/get-session-user'
import { FileS3 } from '@/server/modules/S3'
import { extractS3KeyFromUrl } from '@/server/modules/S3/url'

/**
 * GET /api/resources/files/[id]/content
 * 鉴权后代理文件内容：从 S3 流式返回，私有桶无需公开 ACL
 */
export const GET = withAuth(async (_request, { params, userId }) => {
  const { id } = await params
  const file = await new FileModel(userId).findById(id)
  if (!file?.url) {
    return new Response('File not found', { status: 404 })
  }

  try {
    const key = extractS3KeyFromUrl(file.url)
    const fileS3 = new FileS3()
    const bytes = await fileS3.getFileByteArray(key)

    return new Response(Buffer.from(bytes), {
      headers: {
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        'Content-Type': file.fileType || 'application/octet-stream',
      },
      status: 200,
    })
  } catch (error) {
    console.error('[resources/files/content] GET failed:', error)
    return new Response('Failed to fetch file', { status: 500 })
  }
})
