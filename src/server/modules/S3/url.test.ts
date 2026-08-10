// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fileEnv = vi.hoisted(() => ({
  S3_BUCKET: 'purechat',
  S3_ENABLE_PATH_STYLE: true,
  S3_ENDPOINT: 'http://localhost:9000',
  S3_SET_ACL: false,
}))

vi.mock('@/envs/file', () => ({ fileEnv }))

import { buildPublicS3Url, extractS3KeyFromUrl, resolveFileAccessUrl } from './url'

describe('S3 url helpers', () => {
  beforeEach(() => {
    fileEnv.S3_BUCKET = 'purechat'
    fileEnv.S3_ENABLE_PATH_STYLE = true
    fileEnv.S3_ENDPOINT = 'http://localhost:9000'
    fileEnv.S3_SET_ACL = false
  })

  it('round-trips Chinese / space object keys through path-style URLs', () => {
    const key = 'resources/user/123-GitHub 中文化插件-1.9.2.4-2026-06-21.txt'

    expect(buildPublicS3Url(key)).toBe(
      'http://localhost:9000/purechat/resources/user/123-GitHub%20%E4%B8%AD%E6%96%87%E5%8C%96%E6%8F%92%E4%BB%B6-1.9.2.4-2026-06-21.txt'
    )
    expect(extractS3KeyFromUrl(buildPublicS3Url(key))).toBe(key)
  })

  it('decodes keys from already-stored unencoded path-style URLs', () => {
    const key = 'resources/user/123-GitHub 中文化插件-1.9.2.4-2026-06-21.txt'
    const legacyUrl = `http://localhost:9000/purechat/${key}`

    expect(extractS3KeyFromUrl(legacyUrl)).toBe(key)
  })

  it('supports virtual-hosted-style endpoints', () => {
    fileEnv.S3_ENABLE_PATH_STYLE = false
    fileEnv.S3_ENDPOINT = 'https://s3.us-east-2.amazonaws.com'
    fileEnv.S3_BUCKET = 'pure-next-bucket'

    const key = 'resources/user/你好.txt'
    expect(extractS3KeyFromUrl(buildPublicS3Url(key))).toBe(key)
  })

  it('returns raw keys unchanged when input is not a URL', () => {
    expect(extractS3KeyFromUrl('resources/user/notes.txt')).toBe('resources/user/notes.txt')
  })

  it('proxies access URLs when ACL is disabled', () => {
    expect(resolveFileAccessUrl('file_1', 'http://localhost:9000/purechat/a.txt')).toBe(
      '/api/resources/files/file_1/content'
    )

    fileEnv.S3_SET_ACL = true
    expect(resolveFileAccessUrl('file_1', 'http://localhost:9000/purechat/a.txt')).toBe(
      'http://localhost:9000/purechat/a.txt'
    )
  })
})
