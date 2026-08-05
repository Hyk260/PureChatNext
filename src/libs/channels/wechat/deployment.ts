import { appEnv } from '@/envs/app'

export const isWechatGatewaySupported = () => appEnv.WECHAT_GATEWAY_ENABLED
