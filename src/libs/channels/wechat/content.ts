import type { CDNMedia, FileItem, ImageItem } from '@pure/chat-adapter/wechat'

export type StoredWechatImagePayload = {
  aeskey?: string
  media?: CDNMedia
  thumb_media?: CDNMedia
  type: 'image'
  url?: string
  v: 1
}

export type StoredWechatFilePayload = {
  file_name?: string
  len?: string
  md5?: string
  media?: CDNMedia
  type: 'file'
  v: 1
}

export function encodeWechatImageContent(imageItem: ImageItem): string {
  return JSON.stringify({
    type: 'image',
    v: 1,
    ...(imageItem.aeskey ? { aeskey: imageItem.aeskey } : {}),
    ...(imageItem.media ? { media: imageItem.media } : {}),
    ...(imageItem.thumb_media ? { thumb_media: imageItem.thumb_media } : {}),
    ...(imageItem.url ? { url: imageItem.url } : {}),
  } satisfies StoredWechatImagePayload)
}

export function parseWechatImageContent(content: string): StoredWechatImagePayload | null {
  try {
    const parsed = JSON.parse(content) as Partial<StoredWechatImagePayload>
    return parsed?.v === 1 && parsed.type === 'image' ? (parsed as StoredWechatImagePayload) : null
  } catch {
    return null
  }
}

export function encodeWechatFileContent(fileItem: FileItem): string {
  return JSON.stringify({
    type: 'file',
    v: 1,
    ...(fileItem.file_name ? { file_name: fileItem.file_name } : {}),
    ...(fileItem.len ? { len: fileItem.len } : {}),
    ...(fileItem.md5 ? { md5: fileItem.md5 } : {}),
    ...(fileItem.media ? { media: fileItem.media } : {}),
  } satisfies StoredWechatFilePayload)
}

export function parseWechatFileContent(content: string): StoredWechatFilePayload | null {
  try {
    const parsed = JSON.parse(content) as Partial<StoredWechatFilePayload>
    return parsed?.v === 1 && parsed.type === 'file' ? (parsed as StoredWechatFilePayload) : null
  } catch {
    return null
  }
}
