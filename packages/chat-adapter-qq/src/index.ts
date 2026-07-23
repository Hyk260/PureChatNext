/** @pure/chat-adapter-qq — QQ Bot adapter for Vercel Chat SDK. */
export { createQQAdapter, QQAdapter } from './adapter';
export { QQApiClient } from './api';
export { signWebhookResponse } from './crypto';
export { QQFormatConverter } from './format-converter';
export { QQGatewayConnection, type GatewayLogger, type QQGatewayOptions } from './gateway';
export {
  QQ_EVENT_TYPES,
  QQ_INTENTS,
  QQ_MSG_TYPE,
  QQ_OP_CODES,
  QQ_WS_OP_CODES,
  type QQAccessTokenResponse,
  type QQAdapterConfig,
  type QQAttachment,
  type QQAuthor,
  type QQGatewayHelloData,
  type QQGatewayPayload,
  type QQGatewayReadyData,
  type QQGatewayUrlResponse,
  type QQMessageType,
  type QQRawMessage,
  type QQSendMessageParams,
  type QQSendMessageResponse,
  type QQThreadId,
  type QQWebhookEventData,
  type QQWebhookPayload,
  type QQWebhookVerifyData,
} from './types';
