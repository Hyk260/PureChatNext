import { beforeEach, describe, expect, it, vi } from 'vitest'

const authEnvMock = vi.hoisted(() => ({
  AUTH_APPLE_APP_BUNDLE_IDENTIFIER: undefined as string | undefined,
  AUTH_APPLE_CLIENT_ID: undefined as string | undefined,
  AUTH_APPLE_CLIENT_SECRET: undefined as string | undefined,
  AUTH_GITHUB_ID: undefined as string | undefined,
  AUTH_GITHUB_SECRET: undefined as string | undefined,
}))

vi.mock('@/envs/auth', () => ({
  authEnv: authEnvMock,
}))

import { checkProviderEnvs } from './helpers'

describe('checkProviderEnvs', () => {
  beforeEach(() => {
    authEnvMock.AUTH_APPLE_APP_BUNDLE_IDENTIFIER = undefined
    authEnvMock.AUTH_APPLE_CLIENT_ID = undefined
    authEnvMock.AUTH_APPLE_CLIENT_SECRET = undefined
    authEnvMock.AUTH_GITHUB_ID = undefined
    authEnvMock.AUTH_GITHUB_SECRET = undefined
  })

  it('returns false when any required env is missing', () => {
    authEnvMock.AUTH_GITHUB_ID = 'id'
    expect(checkProviderEnvs(['AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET'])).toBe(false)
  })

  it('returns false when required env is empty string', () => {
    authEnvMock.AUTH_GITHUB_ID = ''
    authEnvMock.AUTH_GITHUB_SECRET = 'secret'
    expect(checkProviderEnvs(['AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET'])).toBe(false)
  })

  it('returns required envs when all present', () => {
    authEnvMock.AUTH_GITHUB_ID = 'id'
    authEnvMock.AUTH_GITHUB_SECRET = 'secret'
    expect(checkProviderEnvs(['AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET'])).toEqual({
      AUTH_GITHUB_ID: 'id',
      AUTH_GITHUB_SECRET: 'secret',
    })
  })

  it('includes optional envs without requiring them', () => {
    authEnvMock.AUTH_APPLE_CLIENT_ID = 'id'
    authEnvMock.AUTH_APPLE_CLIENT_SECRET = 'secret'
    authEnvMock.AUTH_APPLE_APP_BUNDLE_IDENTIFIER = 'com.example.app'

    expect(
      checkProviderEnvs(['AUTH_APPLE_CLIENT_ID', 'AUTH_APPLE_CLIENT_SECRET'], ['AUTH_APPLE_APP_BUNDLE_IDENTIFIER'])
    ).toEqual({
      AUTH_APPLE_APP_BUNDLE_IDENTIFIER: 'com.example.app',
      AUTH_APPLE_CLIENT_ID: 'id',
      AUTH_APPLE_CLIENT_SECRET: 'secret',
    })
  })

  it('still succeeds when optional env is missing', () => {
    authEnvMock.AUTH_APPLE_CLIENT_ID = 'id'
    authEnvMock.AUTH_APPLE_CLIENT_SECRET = 'secret'

    expect(
      checkProviderEnvs(['AUTH_APPLE_CLIENT_ID', 'AUTH_APPLE_CLIENT_SECRET'], ['AUTH_APPLE_APP_BUNDLE_IDENTIFIER'])
    ).toEqual({
      AUTH_APPLE_APP_BUNDLE_IDENTIFIER: undefined,
      AUTH_APPLE_CLIENT_ID: 'id',
      AUTH_APPLE_CLIENT_SECRET: 'secret',
    })
  })
})
