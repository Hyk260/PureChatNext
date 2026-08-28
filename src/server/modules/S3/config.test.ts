// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { isS3Configured } from './config'

const completeConfig = {
  S3_ACCESS_KEY_ID: 'access-key',
  S3_BUCKET: 'bucket',
  S3_ENDPOINT: 'https://s3.example.com',
  S3_SECRET_ACCESS_KEY: 'secret-key',
}

describe('isS3Configured', () => {
  it('returns false when all values are absent', () => {
    expect(isS3Configured({})).toBe(false)
  })

  it('returns false when configuration is incomplete', () => {
    expect(isS3Configured({ ...completeConfig, S3_SECRET_ACCESS_KEY: undefined })).toBe(false)
  })

  it('returns true when all required values are present', () => {
    expect(isS3Configured(completeConfig)).toBe(true)
  })
})
