// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getDesktopPublishConfig } from './desktop-publish-config'

beforeEach(() => {
  vi.stubEnv('S3_ACCESS_KEY_ID', 'test-id')
  vi.stubEnv('S3_SECRET_ACCESS_KEY', 'test-secret')
  vi.stubEnv('S3_BUCKET', 'purechat-1234567890')
  vi.stubEnv('S3_ENDPOINT', 'https://cos.ap-shanghai.myqcloud.com')
  vi.stubEnv('S3_REGION', 'ap-shanghai')
  vi.stubEnv('S3_ENABLE_PATH_STYLE', '0')
  vi.stubEnv('S3_SET_ACL', '0')
  vi.stubEnv('S3_PUBLIC_DOMAIN', '')
  vi.stubEnv('PURECHAT_DESKTOP_UPDATE_URL', '')
})

afterEach(() => vi.unstubAllEnvs())

describe('desktop COS configuration', () => {
  it('derives the public feed from existing S3 fields and supports a custom domain', () => {
    expect(getDesktopPublishConfig().updateUrl).toBe(
      'https://purechat-1234567890.cos.ap-shanghai.myqcloud.com/desktop/'
    )
    expect(getDesktopPublishConfig().clientOptions.requestChecksumCalculation).toBe('WHEN_REQUIRED')
    vi.stubEnv('S3_PUBLIC_DOMAIN', 'https://downloads.example.com')
    expect(getDesktopPublishConfig().updateUrl).toBe('https://downloads.example.com/desktop/')
    vi.stubEnv('PURECHAT_DESKTOP_UPDATE_URL', 'https://mirror.example.com/desktop')
    expect(getDesktopPublishConfig().updateUrl).toBe('https://mirror.example.com/desktop/')
  })

  it('refuses local storage, path-style, wrong regions and incompatible feed paths', () => {
    vi.stubEnv('S3_ENDPOINT', 'http://localhost:9000')
    expect(getDesktopPublishConfig).toThrow('COS 地域 Endpoint')
    vi.stubEnv('S3_ENDPOINT', 'https://cos.ap-shanghai.myqcloud.com')
    vi.stubEnv('S3_ENABLE_PATH_STYLE', '1')
    expect(getDesktopPublishConfig).toThrow('S3_ENABLE_PATH_STYLE=0')
    vi.stubEnv('S3_ENABLE_PATH_STYLE', '0')
    vi.stubEnv('S3_REGION', 'ap-guangzhou')
    expect(getDesktopPublishConfig).toThrow('地域一致')
    vi.stubEnv('S3_REGION', 'ap-shanghai')
    vi.stubEnv('PURECHAT_DESKTOP_UPDATE_URL', 'http://127.0.0.1:5500')
    expect(getDesktopPublishConfig).toThrow('HTTPS')
    vi.stubEnv('PURECHAT_DESKTOP_UPDATE_URL', 'https://downloads.example.com/other/')
    expect(getDesktopPublishConfig).toThrow('路径必须对应')
  })

  it('names missing fields without printing credential values', () => {
    vi.stubEnv('S3_SECRET_ACCESS_KEY', '')
    expect(getDesktopPublishConfig).toThrow('缺少 S3_SECRET_ACCESS_KEY')
  })
})
