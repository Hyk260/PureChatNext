// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SITE_DEFAULT_URL } from '@/const/site'
import * as desktopFetch from '@/utils/desktopFetch'

import { EMAIL_TEMPLATE_PREVIEW_MOCK, getEmailTemplatePreviewParams } from './preview-catalog'

const VERIFY_PATH = '/verify-email?token=preview-token'

const setNodeEnv = (value: string | undefined) => {
  Reflect.set(process.env, 'NODE_ENV', value)
}

describe('EMAIL_TEMPLATE_PREVIEW_MOCK.url', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalAppUrl = process.env.APP_URL

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    setNodeEnv(originalNodeEnv)
    if (originalAppUrl === undefined) {
      delete process.env.APP_URL
    } else {
      process.env.APP_URL = originalAppUrl
    }
  })

  it('uses the local SPA origin in test', () => {
    setNodeEnv('test')
    process.env.APP_URL = 'https://chat.example.com'

    expect(EMAIL_TEMPLATE_PREVIEW_MOCK.url).toBe(`http://localhost:5174${VERIFY_PATH}`)
  })

  it('uses the invitation route for referral defaults', () => {
    expect(getEmailTemplatePreviewParams('referral').url).toBe(
      'http://localhost:5174/accept-referral?referral_context=preview-token'
    )
    expect(getEmailTemplatePreviewParams('verification').url).toBe(`http://localhost:5174${VERIFY_PATH}`)
  })

  it('uses the configured remote server for desktop invitation links', () => {
    setNodeEnv('development')
    vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:5176' } })
    vi.spyOn(desktopFetch, 'getDesktopRemoteBaseUrl').mockReturnValue('https://chat.example.com/')

    expect(getEmailTemplatePreviewParams('referral').url).toBe(
      'https://chat.example.com/accept-referral?referral_context=preview-token'
    )
  })

  it('uses the current site for browser invitation links', () => {
    setNodeEnv('development')
    vi.stubGlobal('window', { location: { origin: 'https://chat.example.com' } })

    expect(getEmailTemplatePreviewParams('referral').url).toBe(
      'https://chat.example.com/accept-referral?referral_context=preview-token'
    )
  })

  it('uses APP_URL in production', () => {
    setNodeEnv('production')
    process.env.APP_URL = 'https://chat.example.com/'

    expect(EMAIL_TEMPLATE_PREVIEW_MOCK.url).toBe(`https://chat.example.com${VERIFY_PATH}`)
  })

  it('falls back to the public site when production APP_URL is missing', () => {
    setNodeEnv('production')
    delete process.env.APP_URL

    expect(EMAIL_TEMPLATE_PREVIEW_MOCK.url).toBe(`${SITE_DEFAULT_URL}${VERIFY_PATH}`)
  })
})
