import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { getSkillFilePreviewKind } from '@/const/community/skillFilePreview'
import { SkillPackageError, sanitizeSkillRelativePath } from '@/server/modules/GitHub/skillFiles'
import { FileS3 } from '@/server/modules/S3'
import { isS3Configured } from '@/server/modules/S3/config'
import { getUserSkillFile } from '@/server/services/userSkill'

const privateCacheHeaders = {
  'Cache-Control': 'private, max-age=3600',
}

const contentTypeForKind = (kind: ReturnType<typeof getSkillFilePreviewKind>, fileType: string) => {
  if (kind === 'markdown') return 'text/markdown; charset=utf-8'
  if (kind === 'text') return 'text/plain; charset=utf-8'
  return fileType || 'application/octet-stream'
}

/**
 * GET /api/user/skills/[id]/files
 * 鉴权后从 S3 读取技能包内单个文件
 * @param request - query `path=` 为包内相对路径
 */
export const GET = withAuth(async (request, { params, userId }) => {
  if (!isS3Configured()) return jsonError('S3 is not configured', 503)

  const { id } = await params
  const path = request.nextUrl.searchParams.get('path')
  if (!path) return jsonError('Missing path')

  try {
    sanitizeSkillRelativePath(path)
  } catch (error) {
    if (error instanceof SkillPackageError) return jsonError('Invalid path', 400)
    throw error
  }

  const file = await getUserSkillFile(userId, id, path)
  if (!file) return jsonError('File not found', 404)

  const kind = getSkillFilePreviewKind(file.path)
  const fileS3 = new FileS3()
  const filename = file.path.split('/').pop() ?? file.path
  const disposition = `inline; filename*=UTF-8''${encodeURIComponent(filename)}`

  try {
    if (kind === 'markdown' || kind === 'text') {
      const text = await fileS3.getFileContent(file.s3Key)
      return new Response(text, {
        headers: {
          ...privateCacheHeaders,
          'Content-Disposition': disposition,
          'Content-Type': contentTypeForKind(kind, file.fileType),
        },
      })
    }

    const bytes = await fileS3.getFileByteArray(file.s3Key)
    return new Response(Buffer.from(bytes), {
      headers: {
        ...privateCacheHeaders,
        'Content-Disposition': disposition,
        'Content-Type': contentTypeForKind(kind, file.fileType),
      },
    })
  } catch (error) {
    console.error('[api/user/skills/files] GET failed:', error)
    return new Response('Failed to fetch file', { status: 500 })
  }
})
