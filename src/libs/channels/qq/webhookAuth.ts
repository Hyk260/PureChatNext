import { authorizeChannelGatewayRequest, resolveChannelGatewayInternalSecret } from '@/server/channel-gateway/internal'

/** Public QQ callbacks use platform verification; WebSocket forwarding uses this internal secret. */
export const resolveQQWebhookSecret = () => resolveChannelGatewayInternalSecret('qq')

export const authorizeQQInternalWebhook = (request: Request) => authorizeChannelGatewayRequest(request, 'qq')
