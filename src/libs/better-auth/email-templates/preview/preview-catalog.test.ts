// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'

import { SITE_DEFAULT_URL } from '@/const/site'

import { EMAIL_TEMPLATE_PREVIEW_MOCK } from './preview-catalog'

const VERIFY_PATH = '/verify-email?token=preview-token'

describe('EMAIL_TEMPLATE_PREVIEW_MOCK.url', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalAppUrl = process.env.APP_URL

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    if (originalAppUrl === undefined) {
      delete process.env.APP_URL
    } else {
      process.env.APP_URL = originalAppUrl
    }
  })

  it('uses the local SPA origin in test', () => {
    process.env.NODE_ENV = 'test'
    process.env.APP_URL = 'https://chat.example.com'

    expect(EMAIL_TEMPLATE_PREVIEW_MOCK.url).toBe(`http://localhost:5174${VERIFY_PATH}`)
  })

  it('uses APP_URL in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.APP_URL = 'https://chat.example.com/'

    expect(EMAIL_TEMPLATE_PREVIEW_MOCK.url).toBe(`https://chat.example.com${VERIFY_PATH}`)
  })

  it('falls back to the public site when production APP_URL is missing', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.APP_URL

    expect(EMAIL_TEMPLATE_PREVIEW_MOCK.url).toBe(`${SITE_DEFAULT_URL}${VERIFY_PATH}`)
  })
})
