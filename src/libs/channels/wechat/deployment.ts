import { gatewayEnv } from '@/envs/gateway'

export const isWechatGatewaySupported = () => gatewayEnv.CHANNEL_GATEWAY_ENABLED
