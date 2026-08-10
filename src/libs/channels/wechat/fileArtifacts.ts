import { createHash } from 'node:crypto'
import path from 'node:path'

import { ChannelEventFileModel } from '@pure/database/models/channelEventFile'
import { FileModel, FileStorageQuotaExceededError } from '@pure/database/models/file'
import type { ChannelEventItem } from '@pure/database/schemas/channel'
import type { FileItem } from '@pure/database/schemas/file'
import { fileEnv, fileStorageLimitBytes } from '@/envs/file'
import { FileS3 } from '@/server/modules/S3'
import { buildPublicS3Url, extractS3KeyFromUrl } from '@/server/modules/S3/url'

export type WechatFileArtifact = {
  artifactId: string
  direction: 'input' | 'output'
  deliveryStatus: 'pending' | 'sending' | 'sent'
  file: FileItem
  sourceFileId: string | null
  summary: string | null
  version: number
}

export class WechatFileArtifactError extends Error {
  constructor(
    readonly code: 'FILE_QUOTA_EXCEEDED' | 'FILE_STORAGE_UNAVAILABLE',
    message: string
  ) {
    super(message)
    this.name = 'WechatFileArtifactError'
  }
}

const isStorageConfigured = () =>
  Boolean(fileEnv.S3_ACCESS_KEY_ID && fileEnv.S3_SECRET_ACCESS_KEY && fileEnv.S3_ENDPOINT && fileEnv.S3_BUCKET)

const safeName = (name: string) => path.basename(name).replace(/[^\p{L}\p{N}._-]+/gu, '-') || 'wechat-file'

export async function persistWechatFile(params: {
  buffer: Buffer
  contentType: string
  deliveryStatus?: 'pending' | 'sent'
  direction: 'input' | 'output'
  event: Pick<ChannelEventItem, 'conversationVersion' | 'id' | 'sessionId'>
  filename: string
  operationHash?: string
  sourceFileId?: string
  summary?: string
  userId: string
  version?: number
}): Promise<WechatFileArtifact> {
  if (!isStorageConfigured()) {
    throw new WechatFileArtifactError('FILE_STORAGE_UNAVAILABLE', '文件存储未配置，暂时无法长期保存或回传文件。')
  }
  const contentHash = createHash('sha256').update(params.buffer).digest('hex')
  const operationHash = params.operationHash ?? contentHash
  const artifactModel = new ChannelEventFileModel()
  const existing = await artifactModel.findByOperation(params.event.id, params.direction, operationHash)
  if (existing) {
    return {
      artifactId: existing.artifact.id,
      direction: existing.artifact.direction as 'input' | 'output',
      deliveryStatus: existing.artifact.deliveryStatus as 'pending' | 'sending' | 'sent',
      file: existing.file,
      sourceFileId: existing.artifact.sourceFileId,
      summary: existing.artifact.summary,
      version: existing.artifact.version,
    }
  }

  const filename = safeName(params.filename)
  const key = `resources/${params.userId}/wechat/${contentHash.slice(0, 16)}-${filename}`
  const storage = new FileS3()
  await storage.uploadBuffer(key, params.buffer, params.contentType)

  const fileModel = new FileModel(params.userId)
  let fileId: string
  try {
    const created = await fileModel.createWithinStorageLimit(
      {
        fileHash: contentHash,
        fileType: params.contentType,
        metadata: {
          channel: 'wechat',
          conversationVersion: params.event.conversationVersion,
          eventId: params.event.id,
        },
        name: filename,
        size: params.buffer.byteLength,
        source: 'wechat',
        url: buildPublicS3Url(key),
      },
      fileStorageLimitBytes,
      true
    )
    fileId = created.id
  } catch (error) {
    await storage.deleteFile(key).catch(() => undefined)
    if (error instanceof FileStorageQuotaExceededError) {
      throw new WechatFileArtifactError('FILE_QUOTA_EXCEEDED', '文件存储空间不足，无法保存或生成新文件。')
    }
    throw error
  }

  const deliveryStatus =
    params.deliveryStatus ?? (params.direction === 'input' ? 'sent' : 'pending')
  const now = deliveryStatus === 'sent' ? new Date() : undefined
  const artifact = await artifactModel.create({
    conversationVersion: params.event.conversationVersion,
    deliveryStatus,
    direction: params.direction,
    eventId: params.event.id,
    fileId,
    metadata: { contentHash },
    operationHash,
    ...(now ? { sentAt: now } : {}),
    sessionId: params.event.sessionId,
    sourceFileId: params.sourceFileId,
    summary: params.summary,
    version: params.version ?? 1,
  })
  const file = await fileModel.findById(fileId)
  if (!artifact || !file) throw new Error('Failed to persist WeChat file artifact')
  return {
    artifactId: artifact.id,
    direction: params.direction,
    deliveryStatus: artifact.deliveryStatus as 'pending' | 'sending' | 'sent',
    file,
    sourceFileId: artifact.sourceFileId,
    summary: artifact.summary,
    version: artifact.version,
  }
}

export async function readWechatFile(userId: string, fileId: string): Promise<{ buffer: Buffer; file: FileItem }> {
  const file = await new FileModel(userId).findById(fileId)
  if (!file) throw new Error('文件不存在或无权访问。')
  const bytes = await new FileS3().getFileByteArray(extractS3KeyFromUrl(file.url))
  return { buffer: Buffer.from(bytes), file }
}

export async function listWechatConversationFiles(sessionId: string, conversationVersion: number) {
  return new ChannelEventFileModel().listForConversation(sessionId, conversationVersion)
}
