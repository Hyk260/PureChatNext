import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { loadFile } from '@pure/file-loaders'
import { downloadMediaFromRawMessage, MessageItemType, MessageState, MessageType } from '@pure/chat-adapter/wechat'
import type { CDNMedia, FileItem, ImageItem, WechatApiClient, WechatRawMessage } from '@pure/chat-adapter/wechat'

/** 持久化在 channel_events.content 中的图片元数据（服务端下载用，勿下发客户端）。 */
export type StoredWechatImagePayload = {
  aeskey?: string
  media?: CDNMedia
  thumb_media?: CDNMedia
  type: 'image'
  url?: string
  v: 1
}

/** 持久化在 channel_events.content 中的文件元数据（服务端下载用，勿下发客户端）。 */
export type StoredWechatFilePayload = {
  file_name?: string
  len?: string
  md5?: string
  media?: CDNMedia
  type: 'file'
  v: 1
}

export const WECHAT_MAX_INBOUND_FILE_BYTES = 10 * 1024 * 1024
export const WECHAT_MAX_PARSED_FILE_CHARS = 120_000

export type PreparedWechatFile = {
  buffer: Buffer
  content: string
  fileName: string
  fileType: string
  mimeType: string
  truncated: boolean
}

export type DownloadedWechatFile = {
  buffer: Buffer
  fileName: string
  mimeType: string
}

export function encodeWechatImageContent(imageItem: ImageItem): string {
  const payload: StoredWechatImagePayload = {
    type: 'image',
    v: 1,
    ...(imageItem.aeskey ? { aeskey: imageItem.aeskey } : {}),
    ...(imageItem.media ? { media: imageItem.media } : {}),
    ...(imageItem.thumb_media ? { thumb_media: imageItem.thumb_media } : {}),
    ...(imageItem.url ? { url: imageItem.url } : {}),
  }
  return JSON.stringify(payload)
}

export function parseWechatImageContent(content: string): StoredWechatImagePayload | null {
  try {
    const parsed = JSON.parse(content) as Partial<StoredWechatImagePayload>
    if (parsed?.v === 1 && parsed.type === 'image') {
      return parsed as StoredWechatImagePayload
    }
  } catch {
    /* not JSON image payload */
  }
  return null
}

export function encodeWechatFileContent(fileItem: FileItem): string {
  const payload: StoredWechatFilePayload = {
    type: 'file',
    v: 1,
    ...(fileItem.file_name ? { file_name: fileItem.file_name } : {}),
    ...(fileItem.len ? { len: fileItem.len } : {}),
    ...(fileItem.md5 ? { md5: fileItem.md5 } : {}),
    ...(fileItem.media ? { media: fileItem.media } : {}),
  }
  return JSON.stringify(payload)
}

export function parseWechatFileContent(content: string): StoredWechatFilePayload | null {
  try {
    const parsed = JSON.parse(content) as Partial<StoredWechatFilePayload>
    if (parsed?.v === 1 && parsed.type === 'file') {
      return parsed as StoredWechatFilePayload
    }
  } catch {
    /* not JSON file payload */
  }
  return null
}

/** Download and parse a supported inbound file without retaining it on disk. */
export async function prepareWechatFileForAgent(
  api: WechatApiClient,
  payload: StoredWechatFilePayload,
  retained?: DownloadedWechatFile,
): Promise<PreparedWechatFile> {
  const downloaded = retained ?? await downloadValidatedWechatFile(api, payload)
  const fileName = path.basename(downloaded.fileName || 'wechat-file') || 'wechat-file'
  // 临时目录路径在运行时才确定；忽略 Turbopack 文件追踪，避免整仓打进 server bundle
  const tempDir = await mkdtemp(path.join(/*turbopackIgnore: true*/ os.tmpdir(), 'purechat-wechat-'))
  const filePath = path.join(/*turbopackIgnore: true*/ tempDir, fileName)
  try {
    await writeFile(filePath, downloaded.buffer)
    const document = await loadFile(filePath, { filename: fileName, fileType: path.extname(fileName).slice(1) })
    if (document.metadata.error) throw new Error(`文件解析失败：${document.metadata.error}`)
    const raw = document.content.trim()
    if (!raw) throw new Error('文件没有可读取的文本内容。')
    const content = raw.slice(0, WECHAT_MAX_PARSED_FILE_CHARS)
    return {
      buffer: downloaded.buffer,
      content,
      fileName,
      fileType: document.fileType,
      mimeType: downloaded.mimeType,
      truncated: raw.length > content.length,
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function downloadValidatedWechatFile(
  api: WechatApiClient,
  payload: StoredWechatFilePayload
): Promise<DownloadedWechatFile> {
  const declaredSize = Number(payload.len)
  if (Number.isFinite(declaredSize) && declaredSize > WECHAT_MAX_INBOUND_FILE_BYTES) {
    throw new Error('文件超过 10MB 限制，无法处理。')
  }
  const downloaded = await downloadStoredWechatFile(api, payload)
  if (!downloaded) throw new Error('微信文件无法下载，可能已过期或缺少媒体凭证。')
  if (downloaded.buffer.byteLength > WECHAT_MAX_INBOUND_FILE_BYTES) {
    throw new Error('文件超过 10MB 限制，无法处理。')
  }

  return downloaded
}

function attachmentBuffer(buffer: unknown): Buffer {
  if (Buffer.isBuffer(buffer)) return buffer
  return Buffer.from(buffer as ArrayBuffer)
}

/** 用入库的 image 元数据经 iLink CDN / URL 拉取字节，供 Dev 监控展示。 */
export async function downloadStoredWechatImage(
  api: WechatApiClient,
  payload: StoredWechatImagePayload
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const stub: WechatRawMessage = {
    client_id: 'dev-image',
    context_token: '',
    create_time_ms: 0,
    from_user_id: '',
    item_list: [
      {
        image_item: {
          ...(payload.aeskey ? { aeskey: payload.aeskey } : {}),
          ...(payload.media ? { media: payload.media } : {}),
          ...(payload.thumb_media ? { thumb_media: payload.thumb_media } : {}),
          ...(payload.url ? { url: payload.url } : {}),
        },
        type: MessageItemType.IMAGE,
      },
    ],
    message_id: 0,
    message_state: MessageState.FINISH,
    message_type: MessageType.USER,
    to_user_id: '',
  }

  const [attachment] = await downloadMediaFromRawMessage(api, stub)
  if (!(attachment as { buffer?: unknown } | undefined)?.buffer) return null
  return {
    buffer: attachmentBuffer((attachment as unknown as { buffer: unknown }).buffer),
    mimeType: attachment.mimeType || 'image/jpeg',
  }
}

/** 用入库的 file 元数据经 iLink CDN 拉取字节，供 Dev 监控下载。 */
export async function downloadStoredWechatFile(
  api: WechatApiClient,
  payload: StoredWechatFilePayload
): Promise<{ buffer: Buffer; fileName: string; mimeType: string } | null> {
  const stub: WechatRawMessage = {
    client_id: 'dev-file',
    context_token: '',
    create_time_ms: 0,
    from_user_id: '',
    item_list: [
      {
        file_item: {
          ...(payload.file_name ? { file_name: payload.file_name } : {}),
          ...(payload.len ? { len: payload.len } : {}),
          ...(payload.md5 ? { md5: payload.md5 } : {}),
          ...(payload.media ? { media: payload.media } : {}),
        },
        type: MessageItemType.FILE,
      },
    ],
    message_id: 0,
    message_state: MessageState.FINISH,
    message_type: MessageType.USER,
    to_user_id: '',
  }

  const [attachment] = await downloadMediaFromRawMessage(api, stub)
  if (!(attachment as { buffer?: unknown } | undefined)?.buffer) return null
  return {
    buffer: attachmentBuffer((attachment as unknown as { buffer: unknown }).buffer),
    fileName: attachment.name || payload.file_name || 'file',
    mimeType: attachment.mimeType || 'application/octet-stream',
  }
}
