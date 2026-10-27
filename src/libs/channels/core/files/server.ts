import { ChannelEventFileModel } from '@pure/database/models/channelEventFile'

import { mapOutboundAttachments } from './index'

export function listOutboundAttachments(eventId: string) {
  return new ChannelEventFileModel().listForEvent(eventId).then(mapOutboundAttachments)
}
