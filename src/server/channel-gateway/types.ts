import type { ChannelBindingItem } from '@pure/database/schemas/channel'

export type ChannelGatewayRuntimeStatus = 'starting' | 'online' | 'degraded' | 'offline' | 'needs_rebind'

export type ChannelGatewayStatusEvent = {
  code?: string
  message?: string
  status: ChannelGatewayRuntimeStatus
}

export interface ChannelGatewayClient {
  readonly done: Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
}

export type ChannelGatewayClientContext = {
  binding: ChannelBindingItem
  reportStatus: (event: ChannelGatewayStatusEvent) => void
}

export interface ChannelGatewayPlatformDefinition {
  readonly platform: string
  readonly transport: 'polling' | 'websocket'
  createClient(context: ChannelGatewayClientContext): Promise<ChannelGatewayClient> | ChannelGatewayClient
  fingerprint(binding: ChannelBindingItem): Promise<string> | string
  shouldManage(binding: ChannelBindingItem): Promise<boolean> | boolean
}

export type ChannelGatewayPlatformSummary = {
  active: number
  degraded: number
  desired: number
  online: number
  starting: number
}

export type ChannelGatewaySummary = {
  enabled: boolean
  error?: string
  platforms: Record<string, ChannelGatewayPlatformSummary>
  running: boolean
  status: 'disabled' | 'starting' | 'healthy' | 'degraded' | 'unhealthy' | 'stopped'
}
