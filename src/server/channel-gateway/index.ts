import { gatewayEnv } from '@/envs/gateway'

import { ChannelGatewayManager } from './manager'
import { qqGatewayPlatform } from './platforms/qq'
import { wechatGatewayPlatform } from './platforms/wechat'
import type { ChannelGatewaySummary } from './types'

const MANAGER_KEY = Symbol.for('purechat.channel-gateway.manager')
type GlobalStore = typeof globalThis & { [MANAGER_KEY]?: ChannelGatewayManager }

function getStoredManager(): ChannelGatewayManager | undefined {
  return (globalThis as GlobalStore)[MANAGER_KEY]
}

export function getChannelGatewayManager(): ChannelGatewayManager {
  const store = globalThis as GlobalStore
  store[MANAGER_KEY] ??= new ChannelGatewayManager({ definitions: [wechatGatewayPlatform, qqGatewayPlatform] })
  return store[MANAGER_KEY]
}

export async function ensureChannelGatewayRunning(): Promise<void> {
  if (!gatewayEnv.CHANNEL_GATEWAY_ENABLED) return
  await getChannelGatewayManager().ensureRunning()
}

/**
 * 绑定后对账。必须 ensureRunning：Next/Turbopack 下 instrumentation
 * 与 Route Handler 不一定共享同一个 isolate，只 reconcile 已有 manager 会变成空操作。
 */
export async function reconcileChannelGateway(): Promise<void> {
  if (!gatewayEnv.CHANNEL_GATEWAY_ENABLED) return
  const manager = getChannelGatewayManager()
  void manager
    .ensureRunning()
    .then(() => manager.reconcileNow())
    .catch((error) => {
      console.error('[Channel Gateway] 启动或对账失败', error)
    })
}

export async function stopChannelGateway(): Promise<void> {
  await getStoredManager()?.stop()
}

export function getChannelGatewaySummary(): ChannelGatewaySummary {
  return getStoredManager()?.getSummary(gatewayEnv.CHANNEL_GATEWAY_ENABLED) ?? {
    enabled: gatewayEnv.CHANNEL_GATEWAY_ENABLED,
    platforms: {},
    running: false,
    status: gatewayEnv.CHANNEL_GATEWAY_ENABLED ? 'starting' : 'disabled',
  }
}

export type {
  ChannelGatewayClient,
  ChannelGatewayPlatformDefinition,
  ChannelGatewaySummary,
} from './types'
export { ChannelGatewayManager } from './manager'
