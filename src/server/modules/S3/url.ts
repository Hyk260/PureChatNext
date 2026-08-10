import { fileEnv } from '@/envs/file'

/** Encode each path segment so Chinese / spaces survive as valid S3 public URLs. */
function encodeS3KeyForUrl(key: string): string {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

/** Decode pathname back to the raw object key used by PutObject / GetObject. */
function decodeS3KeyFromPathname(pathname: string): string {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return pathname
  }
}

export function buildPublicS3Url(key: string): string {
  const endpoint = fileEnv.S3_ENDPOINT!.replace(/\/$/, '')
  const bucket = fileEnv.S3_BUCKET!
  const encodedKey = encodeS3KeyForUrl(key)

  if (fileEnv.S3_ENABLE_PATH_STYLE) {
    return `${endpoint}/${bucket}/${encodedKey}`
  }

  const url = new URL(endpoint)
  return `${url.protocol}//${bucket}.${url.host}/${encodedKey}`
}

/** Extract S3 object key from a stored public URL or raw key. */
export function extractS3KeyFromUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return decodeS3KeyFromPathname(url.replace(/^\//, ''))
  }

  const parsed = new URL(url)
  const pathname = parsed.pathname.replace(/^\//, '')

  if (fileEnv.S3_ENABLE_PATH_STYLE && fileEnv.S3_BUCKET) {
    const prefix = `${fileEnv.S3_BUCKET}/`
    if (pathname.startsWith(prefix)) {
      return decodeS3KeyFromPathname(pathname.slice(prefix.length))
    }
  }

  return decodeS3KeyFromPathname(pathname)
}

/**
 * Client-facing file URL.
 * When ACL public-read is disabled, serve via authenticated app proxy.
 */
export function resolveFileAccessUrl(fileId: string, storageUrl: string): string {
  if (!storageUrl) return ''
  if (fileEnv.S3_SET_ACL) return storageUrl
  return `/api/resources/files/${fileId}/content`
}
