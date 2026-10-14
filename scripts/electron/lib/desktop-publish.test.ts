// @vitest-environment node
import { createHash } from 'node:crypto'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'

import {
  DeleteObjectCommand,
  GetBucketVersioningCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { desktopReleaseAssets } from '../../github-desktop-release.mjs'
import type { DesktopPublishConfig } from './desktop-publish-config'
import { compareVersions, publishDesktopRelease, readDesktopRelease, verifyBuiltUpdateSource } from './desktop-publish'
import type { DesktopPlatform } from './desktop-publish'

const config: DesktopPublishConfig = {
  bucket: 'test-123',
  updateUrl: 'https://downloads.example.com/desktop/',
  setAcl: false,
  clientOptions: {
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    endpoint: 'https://cos.ap-shanghai.myqcloud.com/',
    region: 'ap-shanghai',
    forcePathStyle: false,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  },
}
let directory: string

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'purechat-cos-release-'))
})
afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
  vi.restoreAllMocks()
})

async function createRelease(platform: DesktopPlatform = 'windows', version = '0.3.0') {
  const payload = `PureChat-${version}-${platform === 'windows' ? 'setup.exe' : 'arm64.zip'}`
  const bytes = Buffer.from(`installer ${platform} ${version}`)
  const digest = createHash('sha512').update(bytes).digest('base64')
  const manifestName = platform === 'windows' ? 'latest.yml' : 'latest-mac.yml'
  for (const name of desktopReleaseAssets(version, platform)) {
    const body =
      name === manifestName
        ? JSON.stringify({
            version,
            files: [{ url: payload, size: bytes.length, sha512: digest }],
            path: payload,
            sha512: digest,
          })
        : bytes
    await writeFile(path.join(directory, name), body)
  }
  return readDesktopRelease(directory, platform, version)
}

type StoredObject = { bytes: Buffer; metadata?: Record<string, string> }

function memoryCos() {
  const client = new S3Client(config.clientOptions)
  const objects = new Map<string, StoredObject>()
  const events: string[] = []
  let failedKey = ''
  let versioning: 'Enabled' | undefined
  let failedPublic = ''
  vi.spyOn(client, 'send').mockImplementation(async (command) => {
    if (command instanceof GetBucketVersioningCommand) return { Status: versioning, $metadata: {} } as never
    if (command instanceof ListObjectsV2Command) {
      // 分页时第二页包含旧 Windows 和无关文件，验证不能只清理第一页。
      const pages = [
        ['desktop/PureChat-0.2.9-portable.exe'],
        [
          'desktop/PureChat-0.2.9-setup.exe.blockmap',
          'desktop/PureChat-0.2.9-arm64.zip',
          'user/avatar/keep.png',
          'desktop/nested/PureChat-0.2.9-setup.exe',
        ],
      ]
      const index = command.input.ContinuationToken ? 1 : 0
      return {
        Contents: pages[index].map((Key) => ({ Key })),
        IsTruncated: index === 0,
        NextContinuationToken: index === 0 ? 'page2' : undefined,
        $metadata: {},
      } as never
    }
    const key = 'Key' in command.input ? String(command.input.Key) : ''
    events.push(`${command.constructor.name}:${key}`)
    if (command instanceof PutObjectCommand) {
      if (key === failedKey) throw new Error('upload interrupted')
      if (key.startsWith('.desktop-publish-locks/') && objects.has(key)) throw new Error('lock exists')
      const chunks: Buffer[] = []
      const body = command.input.Body
      if (typeof body === 'string') chunks.push(Buffer.from(body))
      else if (body instanceof Uint8Array) chunks.push(Buffer.from(body))
      else for await (const chunk of body as AsyncIterable<Buffer>) chunks.push(chunk)
      objects.set(key, { bytes: Buffer.concat(chunks), metadata: command.input.Metadata })
      return { $metadata: {} } as never
    }
    if (command instanceof DeleteObjectCommand) {
      objects.delete(key)
      return { $metadata: {} } as never
    }
    const object = objects.get(key)
    if (!object) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' })
    if (command instanceof HeadObjectCommand)
      return { ContentLength: object.bytes.length, Metadata: object.metadata, $metadata: {} } as never
    if (command instanceof GetObjectCommand) {
      const Body = Object.assign(Readable.from([object.bytes]), {
        transformToString: async () => object.bytes.toString('utf8'),
      })
      return { Body, $metadata: {} } as never
    }
    throw new Error('unexpected command')
  })
  const fetchPublic: typeof fetch = async (url) => {
    const key = new URL(String(url)).pathname.slice(1)
    events.push(`public:${key}`)
    const object = objects.get(key)
    if (!object || key === failedPublic) return new Response('not found', { status: 404 })
    if (key.endsWith('.yml')) return new Response(object.bytes.toString())
    return new Response(new Uint8Array(object.bytes.subarray(0, 1)), {
      status: 206,
      headers: { 'content-range': `bytes 0-0/${object.bytes.length}` },
    })
  }
  return {
    client,
    objects,
    events,
    fetchPublic,
    failUpload: (key: string) => {
      failedKey = key
    },
    failPublic: (key: string) => {
      failedPublic = key
    },
    enableVersioning: () => {
      versioning = 'Enabled'
    },
  }
}

describe('desktop release validation', () => {
  it('detects an installation package built against GitHub or a different feed', async () => {
    await writeFile(
      path.join(directory, 'builder-effective-config.yaml'),
      JSON.stringify({ publish: [{ provider: 'github' }] })
    )
    await expect(verifyBuiltUpdateSource(directory, config.updateUrl)).rejects.toThrow('更新源与 COS 地址不一致')
    await writeFile(
      path.join(directory, 'builder-effective-config.yaml'),
      JSON.stringify({ publish: [{ provider: 'generic', url: config.updateUrl }] })
    )
    await expect(verifyBuiltUpdateSource(directory, config.updateUrl)).resolves.toBeUndefined()
  })
  it('checks both platform payloads, checksum mismatches and symlinks', async () => {
    const release = await createRelease()
    expect(release.files).toHaveLength(4)
    expect((await createRelease('mac')).files).toHaveLength(5)
    await writeFile(path.join(directory, 'PureChat-0.3.0-setup.exe'), 'corrupt')
    await expect(readDesktopRelease(directory, 'windows', '0.3.0')).rejects.toThrow('校验失败')
    await createRelease()
    const link = path.join(directory, 'PureChat-0.3.0-portable.exe')
    await rm(link)
    await symlink(path.join(directory, 'PureChat-0.3.0-setup.exe'), link)
    await expect(readDesktopRelease(directory, 'windows', '0.3.0')).rejects.toThrow('普通文件')
  })

  it('rejects external manifest URLs, incorrect legacy fields and prereleases', async () => {
    const release = await createRelease()
    const data = JSON.parse(release.manifest.toString())
    data.files[0].url = 'https://other.example.com/installer.exe'
    await writeFile(path.join(directory, release.manifestName), JSON.stringify(data))
    await expect(readDesktopRelease(directory, 'windows', release.version)).rejects.toThrow('更新文件路径')
    data.files[0].url = 'PureChat-0.3.0-setup.exe'
    data.sha512 = 'wrong'
    await writeFile(path.join(directory, release.manifestName), JSON.stringify(data))
    await expect(readDesktopRelease(directory, 'windows', release.version)).rejects.toThrow('path/sha512')
    expect(() => compareVersions('0.3.0-rc.1', '0.2.9')).toThrow('稳定版本')
    expect(compareVersions('0.10.0', '0.9.9')).toBe(1)
  })
})

describe('COS publication ordering and recovery', () => {
  it('publishes YAML after all assets and only then deletes this platform’s old files across pages', async () => {
    const cos = memoryCos()
    const release = await createRelease()
    await publishDesktopRelease(cos.client, config, release, { fetchPublic: cos.fetchPublic, log: vi.fn() })
    const publish = cos.events.indexOf('PutObjectCommand:desktop/latest.yml')
    const check = cos.events.indexOf('public:desktop/latest.yml')
    const deletes = cos.events.filter((event) => event.startsWith('DeleteObjectCommand:desktop/'))
    expect(publish).toBeGreaterThan(cos.events.indexOf('public:desktop/PureChat-0.3.0-setup.exe.blockmap'))
    expect(check).toBeGreaterThan(publish)
    expect(cos.events.indexOf(deletes[0])).toBeGreaterThan(check)
    expect(deletes).toEqual([
      'DeleteObjectCommand:desktop/PureChat-0.2.9-portable.exe',
      'DeleteObjectCommand:desktop/PureChat-0.2.9-setup.exe.blockmap',
    ])
    expect(cos.objects.has('.desktop-publish-locks/windows.json')).toBe(false)
  })

  it('does not publish YAML or delete old files if any asset upload is interrupted', async () => {
    const cos = memoryCos()
    const release = await createRelease()
    cos.failUpload('desktop/PureChat-0.3.0-portable.exe')
    await expect(publishDesktopRelease(cos.client, config, release, { fetchPublic: cos.fetchPublic })).rejects.toThrow(
      'interrupted'
    )
    expect(cos.events).not.toContain('PutObjectCommand:desktop/latest.yml')
    expect(cos.events.some((event) => event.startsWith('DeleteObjectCommand:desktop/'))).toBe(false)
  })

  it('keeps old files if public download or post-publication YAML verification fails', async () => {
    const cos = memoryCos()
    const release = await createRelease()
    cos.failPublic('desktop/latest.yml')
    await expect(publishDesktopRelease(cos.client, config, release, { fetchPublic: cos.fetchPublic })).rejects.toThrow(
      '公开渠道校验失败'
    )
    expect(cos.events.some((event) => event.startsWith('DeleteObjectCommand:desktop/'))).toBe(false)
    cos.failPublic('')
    await publishDesktopRelease(cos.client, config, release, { fetchPublic: cos.fetchPublic, log: vi.fn() })
    expect(cos.events.filter((event) => event === 'PutObjectCommand:desktop/PureChat-0.3.0-setup.exe')).toHaveLength(1)
    expect(cos.events).toContain('DeleteObjectCommand:desktop/PureChat-0.2.9-portable.exe')
  })

  it('makes dry-run read-only and refuses downgrades and same-version mutations', async () => {
    const cos = memoryCos()
    const release = await createRelease()
    await publishDesktopRelease(cos.client, config, release, { dryRun: true, log: vi.fn() })
    expect(cos.events.some((event) => /PutObject|DeleteObject/.test(event))).toBe(false)
    cos.objects.set('desktop/latest.yml', {
      bytes: Buffer.from(JSON.stringify({ version: '0.4.0', files: [{ url: 'unused', size: 1, sha512: 'x' }] })),
    })
    await expect(publishDesktopRelease(cos.client, config, release, { dryRun: true })).rejects.toThrow('拒绝降级')
    cos.objects.set('desktop/latest.yml', { bytes: Buffer.concat([release.manifest, Buffer.from('\n')]) })
    await expect(publishDesktopRelease(cos.client, config, release, { dryRun: true })).rejects.toThrow(
      '同版本渠道内容不同'
    )
  })

  it('preserves another publisher’s lock and rejects versioned buckets', async () => {
    const cos = memoryCos()
    const release = await createRelease()
    cos.objects.set('.desktop-publish-locks/windows.json', { bytes: Buffer.from('another publisher') })
    await expect(publishDesktopRelease(cos.client, config, release)).rejects.toThrow('已有发布任务')
    expect(cos.objects.get('.desktop-publish-locks/windows.json')?.bytes.toString()).toBe('another publisher')
    expect(cos.events.some((event) => event.startsWith('DeleteObjectCommand'))).toBe(false)
    cos.enableVersioning()
    await expect(publishDesktopRelease(cos.client, config, release)).rejects.toThrow('版本控制')
  })

  it('does not overwrite an existing versioned filename with different bytes', async () => {
    const cos = memoryCos()
    const release = await createRelease()
    const installer = release.files[0]
    cos.objects.set(`desktop/${installer.name}`, { bytes: Buffer.alloc(installer.size, 0) })
    await expect(publishDesktopRelease(cos.client, config, release)).rejects.toThrow('远端文件内容不同')
    expect(cos.events).not.toContain('PutObjectCommand:desktop/latest.yml')
  })
})
