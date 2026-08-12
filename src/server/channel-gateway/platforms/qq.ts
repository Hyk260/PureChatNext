import { createHash } from 'node:crypto'

import { decryptCredentials } from '@/libs/channels/qq/encrypt'
import { QQChannelGatewayClient } from '@/libs/channels/qq/gateway'

import type { ChannelGatewayPlatformDefinition } from '../types'

export const qqGatewayPlatform: ChannelGatewayPlatformDefinition = {
  platform: 'qq',
  transport: 'websocket',
  createClient: ({ binding, reportStatus }) => new QQChannelGatewayClient(binding, reportStatus),
  fingerprint: (binding) => createHash('sha256').update(binding.credentials).digest('hex'),
  shouldManage: (binding) => decryptCredentials(binding.credentials).connectionMode === 'websocket',
}
