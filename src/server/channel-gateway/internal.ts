import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import { appEnv } from '@/envs/app'
import { gatewayEnv } from '@/envs/gateway'
import { serverDBEnv } from '@/envs/serverDB'

type LegacyPlatform = 'qq' | 'wechat'

const PROCESS_SECRET_KEY = Symbol.for('purechat.channel-gateway.internal-secret')

function processSecret(): string {
  const store = globalThis as typeof globalThis & { [PROCESS_SECRET_KEY]?: string }
  store[PROCESS_SECRET_KEY] ??= randomBytes(32).toString('base64url')
  return store[PROCESS_SECRET_KEY]
}

function derivedVaultSecret(): string | undefined {
  const vaultSecret = serverDBEnv.KEY_VAULTS_SECRET?.trim()
  if (!vaultSecret) return undefined
  return createHash('sha256').update(`purechat:channel-gateway:${vaultSecret}`).digest('base64url')
}

export function resolveChannelGatewayInternalSecret(platform?: LegacyPlatform): string {
  const legacy =
    platform === 'wechat' ? gatewayEnv.WECHAT_WEBHOOK_SECRET : platform === 'qq' ? gatewayEnv.QQ_WEBHOOK_SECRET : ''
  return (
    gatewayEnv.CHANNEL_GATEWAY_INTERNAL_SECRET?.trim() ||
    legacy?.trim() ||
    appEnv.CRON_SECRET?.trim() ||
    derivedVaultSecret() ||
    processSecret()
  )
}

export function authorizeChannelGatewayRequest(request: Request, platform?: LegacyPlatform): boolean {
  const actual = request.headers.get('authorization') || ''
  const expected = `Bearer ${resolveChannelGatewayInternalSecret(platform)}`
  const actualHash = createHash('sha256').update(actual).digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return timingSafeEqual(actualHash, expectedHash)
}

export function buildChannelGatewayWebhookUrl(pathname: string): string {
  const configured = gatewayEnv.CHANNEL_GATEWAY_INTERNAL_URL?.trim().replace(/\/$/, '')
  const port = process.env.PORT?.trim() || (process.env.DOCKER ? '3210' : '3000')
  const baseUrl = configured || `http://127.0.0.1:${port}`
  return `${baseUrl}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
}

export function buildChannelGatewayHeaders(platform?: LegacyPlatform): Record<string, string> {
  return {
    Authorization: `Bearer ${resolveChannelGatewayInternalSecret(platform)}`,
    'Content-Type': 'application/json',
  }
}
