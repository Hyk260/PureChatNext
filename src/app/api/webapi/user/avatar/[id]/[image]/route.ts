import { UserService } from '@/server/services/user'

type Params = Promise<{ id: string; image: string }>

const CONTENT_TYPE_MAP: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpg',
  png: 'image/png',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
}

function getContentType(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || ''
  return CONTENT_TYPE_MAP[extension] || 'application/octet-stream'
}

const userService = new UserService()

/**
 * 获取用户头像
 * GET /api/webapi/user/avatar/:id/:image
 */
export const GET = async (_req: Request, segmentData: { params: Params }) => {
  try {
    const params = await segmentData.params
    const type = getContentType(params.image)

    const userAvatar = await userService.getUserAvatar(params.id, params.image)
    if (!userAvatar) {
      return new Response('Avatar not found', {
        status: 404,
      })
    }

    return new Response(userAvatar, {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Type': type,
      },
      status: 200,
    })
  } catch (error) {
    console.error('Error fetching user avatar:', error)
    return new Response('Internal server error', {
      status: 500,
    })
  }
}
