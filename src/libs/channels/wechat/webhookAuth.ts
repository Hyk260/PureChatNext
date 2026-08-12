import { authorizeChannelGatewayRequest, resolveChannelGatewayInternalSecret } from '@/server/channel-gateway/internal'

export const resolveWechatWebhookSecret = () => resolveChannelGatewayInternalSecret('wechat')
export const authorizeWechatWebhook = (request: Request) => authorizeChannelGatewayRequest(request, 'wechat')
