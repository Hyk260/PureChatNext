import debug from 'debug'

import { isChannelLogPlatform } from '@pure/types'
import type { ChannelLogInput } from '@pure/types'

export { channelErrorCode } from '@pure/database/utils/channelGatewayLogs'

const log = debug('channel:gateway:diagnostics')

export async function recordChannelGatewayLog(input: ChannelLogInput): Promise<void> {
  try {
    const { ChannelGatewayLogModel } = await import('@pure/database/models/channelGatewayLog')
    await new ChannelGatewayLogModel().append(input)
  } catch {
    log('diagnostic write failed platform=%s event=%s', input.platform, input.event)
  }
}

export async function recordBindingGatewayLog(bindingId: string, input: Omit<ChannelLogInput, 'userId' | 'platform' | 'bindingId'>): Promise<void> {
  try {
    const { ChannelBindingModel } = await import('@pure/database/models/channelBinding')
    const binding = await new ChannelBindingModel().findById(bindingId)
    if (!binding || !isChannelLogPlatform(binding.platform)) return
    await recordChannelGatewayLog({ ...input, bindingId, platform: binding.platform, userId: binding.userId })
  } catch {
    log('diagnostic binding lookup failed event=%s', input.event)
  }
}

export async function pruneChannelGatewayLogs(): Promise<void> {
  try {
    const { ChannelGatewayLogModel } = await import('@pure/database/models/channelGatewayLog')
    await new ChannelGatewayLogModel().prune()
  } catch {
    log('diagnostic cleanup failed')
  }
}
