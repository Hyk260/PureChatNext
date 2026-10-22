import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { buffer } from 'node:stream/consumers'
import { setTimeout as delay } from 'node:timers/promises'

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  PutObjectCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3'
import type { CompletedPart, S3Client } from '@aws-sdk/client-s3'

import type { DesktopPublishConfig } from './desktop-publish-config'
import type { PublishFile } from './desktop-publish'

const PART_SIZE = 2 * 1024 * 1024
const REQUEST_TIMEOUT = 5 * 60_000
const PART_ATTEMPTS = 3

type UploadError = Error & {
  code?: string
  $metadata?: { httpStatusCode?: number; requestId?: string }
}

function canRetry(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const { $metadata, code } = error as UploadError
  const status = $metadata?.httpStatusCode
  return (
    status === 429 ||
    (status !== undefined && status >= 500) ||
    ['AbortError', 'TimeoutError', 'RequestTimeout', 'SlowDown'].includes(error.name) ||
    ['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'EAI_AGAIN'].includes(String(code))
  )
}

function formatUploadError(error: unknown): string {
  if (!(error instanceof Error)) return '请求失败'
  const { $metadata, code, cause } = error as UploadError
  const details = [`${error.name}: ${error.message}`]
  if (code) details.push(`code=${code}`)
  if ($metadata?.httpStatusCode) details.push(`HTTP ${$metadata.httpStatusCode}`)
  if ($metadata?.requestId) details.push(`requestId=${$metadata.requestId}`)
  if (cause instanceof Error) details.push(`cause=${cause.name}: ${cause.message}`)
  return details.join('，')
}

/** 分块先完整读入内存再发送，避免不可重放的流式 PUT；日志只报告 COS 已确认的字节数。 */
export async function uploadDesktopAsset(
  client: S3Client,
  config: Pick<DesktopPublishConfig, 'bucket' | 'setAcl'>,
  asset: PublishFile,
  key: string,
  log: (message: string) => void
) {
  const object = {
    Bucket: config.bucket,
    Key: key,
    ContentType: 'application/octet-stream',
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: { sha512: asset.sha512 },
    ACL: config.setAcl ? ('public-read' as const) : undefined,
  }
  const readPart = async (start: number, length: number) => {
    const bytes = await buffer(createReadStream(asset.file, { start, end: start + length - 1 }))
    if (bytes.length !== length) throw new Error(`上传文件长度改变: ${asset.name}`)
    return bytes
  }

  if (asset.size <= PART_SIZE) {
    const bytes = await readPart(0, asset.size)
    await client.send(
      new PutObjectCommand({
        ...object,
        Body: bytes,
        ContentLength: bytes.length,
        ContentMD5: createHash('md5').update(bytes).digest('base64'),
      }),
      { abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT) }
    )
    return
  }

  log(
    `初始化 COS 分块上传: ${asset.name} (${Math.ceil(asset.size / PART_SIZE)} 块，每块最多 ${PART_SIZE / 1024 / 1024} MiB)`
  )
  const { UploadId } = await client.send(new CreateMultipartUploadCommand(object), {
    abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT),
  })
  if (!UploadId) throw new Error(`COS 分块上传缺少 UploadId: ${asset.name}`)
  const upload = { Bucket: config.bucket, Key: key, UploadId }
  try {
    const parts: CompletedPart[] = []
    for (let offset = 0; offset < asset.size; offset += PART_SIZE) {
      const bytes = await readPart(offset, Math.min(PART_SIZE, asset.size - offset))
      const partNumber = parts.length + 1
      const command = new UploadPartCommand({
        ...upload,
        PartNumber: partNumber,
        Body: bytes,
        ContentLength: bytes.length,
        ContentMD5: createHash('md5').update(bytes).digest('base64'),
      })
      for (let attempt = 1; ; attempt++) {
        log(
          `上传 COS 分块: ${asset.name} 第 ${partNumber} 块 (${bytes.length} bytes，第 ${attempt}/${PART_ATTEMPTS} 次，限时 ${REQUEST_TIMEOUT / 1000}s)`
        )
        const startedAt = performance.now()
        try {
          const { ETag } = await client.send(command, { abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT) })
          if (!ETag) throw new Error(`COS 分块缺少 ETag: ${asset.name} 第 ${partNumber} 块`)
          parts.push({ PartNumber: partNumber, ETag })
          const seconds = Math.max((performance.now() - startedAt) / 1000, 0.001)
          log(
            `COS 分块上传完成: ${asset.name} 第 ${partNumber} 块，耗时 ${seconds.toFixed(1)}s，${(bytes.length / 1024 / seconds).toFixed(1)} KiB/s`
          )
          break
        } catch (error) {
          const seconds = ((performance.now() - startedAt) / 1000).toFixed(1)
          const message = `COS 分块上传失败: ${asset.name} 第 ${partNumber} 块，第 ${attempt}/${PART_ATTEMPTS} 次，耗时 ${seconds}s，${formatUploadError(error)}`
          log(message)
          if (attempt >= PART_ATTEMPTS || !canRetry(error)) throw new Error(message, { cause: error })
          log(`COS 分块上传重试: ${asset.name} 第 ${partNumber} 块，${attempt}s 后重试`)
          await delay(attempt * 1000)
        }
      }
      log(`COS 已确认上传: ${asset.name} ${offset + bytes.length}/${asset.size} bytes`)
    }
    log(`合并 COS 分块: ${asset.name}`)
    await client.send(new CompleteMultipartUploadCommand({ ...upload, MultipartUpload: { Parts: parts } }), {
      abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT),
    })
  } catch (error) {
    try {
      await client.send(new AbortMultipartUploadCommand(upload), { abortSignal: AbortSignal.timeout(30_000) })
      log(`已取消未完成的 COS 分块上传: ${asset.name}`)
    } catch (cleanupError) {
      log(
        `清理 COS 分块失败: ${asset.name} UploadId=${UploadId}，${cleanupError instanceof Error ? cleanupError.message : '请求失败'}`
      )
    }
    throw error
  }
}
