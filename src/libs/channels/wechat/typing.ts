import type { WechatApiClient } from '@pure/chat-adapter/wechat'

/** Starts and stops the iLink indicator without putting either network request on the processing critical path. */
export function startWechatTyping(
  api: Pick<WechatApiClient, 'getConfig' | 'sendTyping'>,
  externalUserId: string,
  contextToken: string
): () => void {
  let stopped = false
  const ticket = api
    .getConfig(externalUserId, contextToken)
    .then((config) => config.typing_ticket?.trim() || null)
    .catch(() => null)

  void ticket.then((typingTicket) => {
    if (typingTicket && !stopped) void api.sendTyping(externalUserId, typingTicket, true).catch(() => {})
  })

  return () => {
    if (stopped) return
    stopped = true
    void ticket.then((typingTicket) => {
      if (typingTicket) void api.sendTyping(externalUserId, typingTicket, false).catch(() => {})
    })
  }
}
