import { fileEnv } from '@/envs/file'
import { buildPublicS3Url, extractS3KeyFromUrl } from '@/server/modules/S3/url'

const AVATAR_PROXY_PATH = '/api/webapi/user/avatar/'
const CURRENT_AVATAR_BASENAME = 'avatar'

export function avatarKeyPrefix(userId: string) {
  return `user/avatar/${userId}/`
}

export function currentAvatarFilename(ext: string) {
  return `${CURRENT_AVATAR_BASENAME}.${ext}`
}

export function avatarObjectKey(userId: string, filename: string) {
  return `${avatarKeyPrefix(userId)}${filename}`
}

/** Client-facing avatar URL. Custom domain / public ACL use S3; otherwise a same-origin proxy path. */
export function buildAvatarAccessUrl(userId: string, filename: string, s3Key: string) {
  if (fileEnv.S3_PUBLIC_DOMAIN || fileEnv.S3_SET_ACL) {
    return buildPublicS3Url(s3Key)
  }
  return `${AVATAR_PROXY_PATH}${userId}/${filename}`
}

/** Stable S3 keys need a changing query so browsers / CDNs do not keep the previous bytes. */
export function withAvatarCacheBust(url: string, version: string | number) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${version}`
}

/** Map a stored avatar URL back to this user's S3 object key, if it belongs to them. */
export function extractOwnedAvatarKey(avatar: string | null | undefined, userId: string): string | undefined {
  if (!avatar) return undefined

  const prefix = avatarKeyPrefix(userId)
  const proxyPath = `${AVATAR_PROXY_PATH}${userId}/`
  const proxyIndex = avatar.indexOf(proxyPath)
  if (proxyIndex !== -1) {
    const filename = decodeURIComponent(avatar.slice(proxyIndex + proxyPath.length).split(/[?#]/, 1)[0] ?? '')
    return filename ? `${prefix}${filename}` : undefined
  }

  try {
    const key = extractS3KeyFromUrl(avatar)
    if (key.startsWith(prefix) && key !== prefix) return key
  } catch {
    return undefined
  }

  return undefined
}
