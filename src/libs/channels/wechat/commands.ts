import {
  buildChannelHelpText,
  buildChannelWelcomeText,
  parseChannelCommand,
} from '../core/commands'

export const WECHAT_HELP_TEXT = buildChannelHelpText({
  footer: '当前版本仅支持私聊文本消息。',
})

/** 扫码绑定成功后的欢迎语（首条入站消息时可发送）。 */
export function buildWechatWelcomeText(agentTitle: string) {
  return buildChannelWelcomeText(agentTitle, {
    bindHint: '扫码绑定已成功，可以直接发消息和我对话。',
  })
}

/** @deprecated 使用 parseChannelCommand；保留别名供既有导入兼容。 */
export const parseWechatCommand = parseChannelCommand
