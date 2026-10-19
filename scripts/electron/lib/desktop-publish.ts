import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  DeleteObjectCommand,
  GetBucketVersioningCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import { load } from 'js-yaml'
import { z } from 'zod'

import { desktopReleaseAssets } from '../../github-desktop-release.mjs'
import { DESKTOP_OBJECT_PREFIX } from './desktop-publish-config'
import type { DesktopPublishConfig } from './desktop-publish-config'

export type DesktopPlatform = 'windows' | 'mac'
export const DESKTOP_PLATFORMS: DesktopPlatform[] = ['windows', 'mac']
const MANIFESTS = { windows: 'latest.yml', mac: 'latest-mac.yml' }
const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const ASSET_PATTERNS = {
  windows: /^PureChat-(\d+\.\d+\.\d+)-(?:setup\.exe(?:\.blockmap)?|portable\.exe)$/,
  mac: /^PureChat-(\d+\.\d+\.\d+)-arm64\.(?:zip|dmg)(?:\.blockmap)?$/,
}
const metadataSchema = z
  .object({
    version: z.string().regex(STABLE_VERSION),
    files: z.array(z.object({ url: z.string(), size: z.number().int().positive(), sha512: z.string().min(1) })).min(1),
    path: z.string().optional(),
    sha512: z.string().optional(),
    packages: z.never().optional(),
  })
  .passthrough()

export interface PublishFile {
  name: string
  file: string
  size: number
  sha512: string
}

export type DesktopReleaseMetadata = z.infer<typeof metadataSchema>

/** 本地 builder 配置存在时确认包内更新源，GitHub 下载的纯发行资产没有该文件。 */
export async function verifyBuiltUpdateSource(directory: string, updateUrl: string) {
  let source: string
  try {
    source = await readFile(path.join(directory, 'builder-effective-config.yaml'), 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return
    throw error
  }
  const config = z
    .object({ publish: z.array(z.object({ provider: z.string(), url: z.string().optional() })) })
    .parse(load(source))
  const feed = config.publish[0]
  if (
    feed?.provider !== 'generic' ||
    !feed.url ||
    new URL(feed.url.endsWith('/') ? feed.url : `${feed.url}/`).href !== updateUrl
  ) {
    throw new Error('安装包更新源与 COS 地址不一致，请用 package:desktop:<平台>:upload 重新打包')
  }
}

export interface DesktopRelease {
  platform: DesktopPlatform
  version: string
  files: PublishFile[]
  manifestName: string
  manifest: Buffer
}

export function compareVersions(left: string, right: string): number {
  if (!STABLE_VERSION.test(left) || !STABLE_VERSION.test(right)) throw new Error('仅支持稳定版本 X.Y.Z')
  const a = left.split('.').map(BigInt)
  const b = right.split('.').map(BigInt)
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1
  }
  return 0
}

async function sha512(body: AsyncIterable<Uint8Array>): Promise<string> {
  const hash = createHash('sha512')
  for await (const chunk of body) hash.update(chunk)
  return hash.digest('base64')
}

/** 只读取发行清单中的普通文件，拒绝链接、跨目录路径和不匹配的元数据。 */
export async function readDesktopRelease(
  directory: string,
  platform: DesktopPlatform,
  version: string
): Promise<DesktopRelease> {
  const names = desktopReleaseAssets(version, platform)
  const files: PublishFile[] = []
  for (const name of names) {
    const file = path.resolve(directory, name)
    const stat = await lstat(file)
    if (!stat.isFile() || stat.size <= 0) throw new Error(`发行产物必须是非空普通文件: ${name}`)
    files.push({ name, file, size: stat.size, sha512: await sha512(createReadStream(file)) })
  }
  const manifestName = MANIFESTS[platform]
  const manifest = await readFile(path.resolve(directory, manifestName))
  const metadata = metadataSchema.parse(load(manifest.toString('utf8')))
  if (metadata.version !== version) throw new Error(`${manifestName} 版本不一致`)
  const referenced = new Set<string>()
  for (const entry of metadata.files) {
    const file = files.find((item) => item.name === entry.url)
    if (!file || file.name.endsWith('.yml') || file.name.endsWith('.blockmap') || referenced.has(entry.url)) {
      throw new Error(`无效或重复的更新文件路径: ${entry.url}`)
    }
    if (file.size !== entry.size || file.sha512 !== entry.sha512) throw new Error(`更新文件校验失败: ${entry.url}`)
    referenced.add(entry.url)
  }
  const payload = platform === 'windows' ? `PureChat-${version}-setup.exe` : `PureChat-${version}-arm64.zip`
  if (!referenced.has(payload)) throw new Error(`渠道 YAML 缺少更新载荷: ${payload}`)
  if (metadata.path !== undefined) {
    const primary = metadata.files.find((entry) => entry.url === metadata.path)
    if (!primary || primary.sha512 !== metadata.sha512) throw new Error('YAML path/sha512 与 files 不一致')
  }
  return { platform, version, files, manifestName, manifest }
}

function isMissing(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return ['NoSuchKey', 'NotFound'].includes(error.name)
}

async function getText(client: S3Client, bucket: string, key: string): Promise<string | undefined> {
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (!response.Body) throw new Error(`对象内容为空: ${key}`)
    return response.Body.transformToString()
  } catch (error) {
    if (isMissing(error)) return undefined
    throw error
  }
}

/** COS 禁止覆盖头仅适用于未启用版本控制的桶，不冒充通用 S3 条件写。 */
async function requireUnversionedBucket(client: S3Client, bucket: string) {
  const { Status } = await client.send(new GetBucketVersioningCommand({ Bucket: bucket }))
  if (Status) throw new Error('COS 桶曾启用版本控制，无法使用禁止覆盖发布锁；请使用未启用版本控制的发行桶')
}

async function acquirePublishLock(client: S3Client, bucket: string, platform: DesktopPlatform) {
  const key = `.desktop-publish-locks/${platform}.json`
  const token = randomUUID()
  const body = JSON.stringify({ token, createdAt: new Date().toISOString() })
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/json' })
  command.middlewareStack.add(
    (next) => async (args) => {
      const request = args.request as { headers: Record<string, string> }
      request.headers['x-cos-forbid-overwrite'] = 'true'
      return next(args)
    },
    { step: 'build', name: 'cosForbidOverwrite' }
  )
  try {
    await client.send(command)
  } catch (error) {
    const existing = await getText(client, bucket, key)
    if (existing !== body) {
      if (existing)
        throw new Error(`该平台已有发布任务，或上次任务留下锁: ${key}；确认无任务运行后在 COS 控制台清理该锁`)
      throw error
    }
  }
  return async () => {
    if ((await getText(client, bucket, key)) !== body) throw new Error(`发布锁归属改变，拒绝删除: ${key}`)
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  }
}

async function checkPublicFile(url: string, size: number, fetchPublic: typeof fetch) {
  const response = await fetchPublic(url, {
    headers: { Range: 'bytes=0-0' },
    signal: AbortSignal.timeout(30_000),
    cache: 'no-store',
  })
  try {
    if (response.status !== 206 || response.headers.get('content-range') !== `bytes 0-0/${size}`) {
      throw new Error(`公开下载或 Range 校验失败: ${url} (HTTP ${response.status})`)
    }
    if ((await response.arrayBuffer()).byteLength !== 1) throw new Error(`Range 响应长度错误: ${url}`)
  } finally {
    await response.body?.cancel().catch(() => undefined)
  }
}

async function listOldAssets(client: S3Client, bucket: string, release: DesktopRelease): Promise<string[]> {
  const keys: string[] = []
  let token: string | undefined
  do {
    const result = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: DESKTOP_OBJECT_PREFIX, ContinuationToken: token })
    )
    for (const object of result.Contents ?? []) {
      if (!object.Key?.startsWith(DESKTOP_OBJECT_PREFIX)) continue
      const name = object.Key.slice(DESKTOP_OBJECT_PREFIX.length)
      const match = ASSET_PATTERNS[release.platform].exec(name)
      if (match && compareVersions(match[1], release.version) < 0) keys.push(object.Key)
    }
    token = result.IsTruncated ? result.NextContinuationToken : undefined
    if (result.IsTruncated && !token) throw new Error('COS 分页缺少 continuation token，停止清理')
  } while (token)
  return keys
}

/** 安装包先上传，YAML 最后生效；验证公开渠道成功之后才清理本平台旧版。 */
export async function publishDesktopRelease(
  client: S3Client,
  config: DesktopPublishConfig,
  release: DesktopRelease,
  options: { dryRun?: boolean; fetchPublic?: typeof fetch; log?: (message: string) => void } = {}
) {
  const log = options.log ?? console.info
  const fetchPublic = options.fetchPublic ?? fetch
  const key = (name: string) => `${DESKTOP_OBJECT_PREFIX}${name}`
  const manifestKey = key(release.manifestName)
  log(`检查 COS 桶版本控制: ${config.bucket}`)
  await requireUnversionedBucket(client, config.bucket)
  if (!options.dryRun) log(`获取 ${release.platform} 发布锁`)
  const releaseLock = options.dryRun ? undefined : await acquirePublishLock(client, config.bucket, release.platform)
  try {
    log(`读取当前渠道清单: ${manifestKey}`)
    const previous = await getText(client, config.bucket, manifestKey)
    if (previous !== undefined) {
      const metadata = metadataSchema.parse(load(previous))
      const order = compareVersions(release.version, metadata.version)
      if (order < 0) throw new Error(`拒绝降级: ${metadata.version} → ${release.version}`)
      if (order === 0 && previous !== release.manifest.toString('utf8'))
        throw new Error('同版本渠道内容不同，必须递增版本号')
    }
    log(`扫描 ${release.platform} 旧版本文件`)
    const oldKeys = await listOldAssets(client, config.bucket, release)
    log(`${options.dryRun ? '[dry-run] ' : ''}${release.platform} ${release.version} → ${config.updateUrl}`)
    if (options.dryRun) {
      log(`计划上传: ${release.files.map((file) => file.name).join(', ')}`)
      log(`计划删除: ${oldKeys.join(', ') || '无'}`)
      return
    }

    const assets = release.files.filter((file) => file.name !== release.manifestName)
    for (const asset of assets) {
      log(`检查 COS 文件: ${asset.name}`)
      let existingHash: string | undefined
      try {
        const remote = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key(asset.name) }))
        if (remote.ContentLength !== asset.size) throw new Error(`同版本远端文件长度不同: ${asset.name}`)
        existingHash = remote.Metadata?.sha512
        if (!existingHash) {
          log(`COS 文件无 SHA-512 元数据，下载并复核: ${asset.name}`)
          const response = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key(asset.name) }))
          if (!response.Body) throw new Error(`远端文件内容为空: ${asset.name}`)
          existingHash = await sha512(response.Body as AsyncIterable<Uint8Array>)
        }
      } catch (error) {
        if (!isMissing(error)) throw error
      }
      if (existingHash && existingHash !== asset.sha512) throw new Error(`同版本远端文件内容不同: ${asset.name}`)
      if (!existingHash) {
        log(`上传 COS 文件: ${asset.name} (${asset.size} bytes)`)
        const body = createReadStream(asset.file)
        try {
          await client.send(
            new PutObjectCommand({
              Bucket: config.bucket,
              Key: key(asset.name),
              Body: body,
              ContentLength: asset.size,
              ContentType: 'application/octet-stream',
              CacheControl: 'public, max-age=31536000, immutable',
              Metadata: { sha512: asset.sha512 },
              ACL: config.setAcl ? 'public-read' : undefined,
            })
          )
        } finally {
          body.destroy()
        }
        log(`COS 上传完成: ${asset.name}`)
      } else {
        log(`复用已校验的 COS 文件: ${asset.name}`)
      }
      log(`校验公开下载: ${asset.name}`)
      await checkPublicFile(new URL(asset.name, config.updateUrl).href, asset.size, fetchPublic)
      log(`公开下载校验通过: ${asset.name}`)
    }

    log(`上传渠道清单: ${release.manifestName}`)
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: manifestKey,
        Body: release.manifest,
        ContentType: 'application/yaml',
        CacheControl: 'no-cache',
        ACL: config.setAcl ? 'public-read' : undefined,
      })
    )
    log(`校验公开渠道清单: ${release.manifestName}`)
    const response = await fetchPublic(new URL(release.manifestName, config.updateUrl), {
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    })
    if (!response.ok || (await response.text()) !== release.manifest.toString('utf8')) {
      throw new Error('公开渠道校验失败，保留旧文件；修复域名/缓存后重试')
    }
    log(`公开渠道清单校验通过: ${release.manifestName}`)
    log(`清理 ${oldKeys.length} 个旧版 ${release.platform} 文件`)
    for (const oldKey of oldKeys) {
      // 一次删除一个对象，避免 COS 对 AWS SDK 新版批量删除校验头的兼容差异。
      log(`删除旧版 COS 文件: ${oldKey}`)
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: oldKey }))
    }
    log(`已发布 ${release.version}，清理 ${oldKeys.length} 个旧 ${release.platform} 文件`)
  } finally {
    if (releaseLock) log(`释放 ${release.platform} 发布锁`)
    await releaseLock?.()
  }
}
