import { fileEnv } from '@/envs/file'

export function buildPublicS3Url(key: string): string {
  const endpoint = fileEnv.S3_ENDPOINT!.replace(/\/$/, '')
  const bucket = fileEnv.S3_BUCKET!

  if (fileEnv.S3_ENABLE_PATH_STYLE) {
    return `${endpoint}/${bucket}/${key}`
  }

  const url = new URL(endpoint)
  return `${url.protocol}//${bucket}.${url.host}/${key}`
}

/** Extract S3 object key from a stored public URL or raw key. */
export function extractS3KeyFromUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return url.replace(/^\//, '')
  }

  const parsed = new URL(url)
  const pathname = parsed.pathname.replace(/^\//, '')

  if (fileEnv.S3_ENABLE_PATH_STYLE && fileEnv.S3_BUCKET) {
    const prefix = `${fileEnv.S3_BUCKET}/`
    if (pathname.startsWith(prefix)) {
      return pathname.slice(prefix.length)
    }
  }

  return pathname
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
