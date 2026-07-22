export { encryptCredentials, decryptCredentials, type WechatCredentials } from './encrypt'
export { setContextToken, getContextToken } from './contextToken'
export { generateWechatAgentReply, handleWechatMention } from './agentBridge'
export { getOrCreateWechatChat, invalidateWechatChat } from './chatBot'
export {
  pollBinding,
  pollAllEnabledBindings,
  DEFAULT_DURATION_MS,
  WECHAT_PLATFORM,
} from './poller'
export { authorizeWechatWebhook, resolveWechatWebhookSecret } from './webhookAuth'

// Re-export protocol API from adapter package for convenience
export {
  fetchQrCode,
  pollQrStatus,
  WechatApiClient,
  WECHAT_RET_CODES,
  MessageType,
  MessageState,
  MessageItemType,
} from '@pure/chat-adapter-wechat'
export type {
  QrCodeResponse,
  QrStatusResponse,
  WechatRawMessage,
} from '@pure/chat-adapter-wechat'
