import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  appEnv: { CRON_SECRET: undefined as string | undefined },
  gatewayEnv: {
    CHANNEL_GATEWAY_INTERNAL_SECRET: undefined as string | undefined,
    WECHAT_WEBHOOK_SECRET: undefined as string | undefined,
    QQ_WEBHOOK_SECRET: undefined as string | undefined,
  },
}))

vi.mock('@/envs/app', () => ({ appEnv: mocks.appEnv }))
vi.mock('@/envs/gateway', () => ({ gatewayEnv: mocks.gatewayEnv }))
vi.mock('@/envs/serverDB', () => ({ serverDBEnv: { KEY_VAULTS_SECRET: undefined } }))

import { authorizeWechatWebhook } from '../webhookAuth'

describe('authorizeWechatWebhook', () => {
  beforeEach(() => {
    mocks.appEnv.CRON_SECRET = undefined
    mocks.gatewayEnv.CHANNEL_GATEWAY_INTERNAL_SECRET = undefined
    mocks.gatewayEnv.WECHAT_WEBHOOK_SECRET = undefined
    mocks.gatewayEnv.QQ_WEBHOOK_SECRET = undefined
  })

  it('fails closed when no secret is configured', () => {
    expect(authorizeWechatWebhook(new Request('http://localhost'))).toBe(false)
  })

  it('rejects a wrong secret and accepts the configured secret', () => {
    mocks.gatewayEnv.WECHAT_WEBHOOK_SECRET = 'expected-secret'
    expect(authorizeWechatWebhook(new Request('http://localhost', { headers: { Authorization: 'Bearer wrong' } }))).toBe(false)
    expect(
      authorizeWechatWebhook(
        new Request('http://localhost', { headers: { Authorization: 'Bearer expected-secret' } })
      )
    ).toBe(true)
  })
})
