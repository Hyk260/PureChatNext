export const WECHAT_HELP_TEXT = [
  '可用指令：',
  '/help（/h） — 查看帮助',
  '/new — 取消当前生成并开始新对话',
  '/stop — 停止当前生成',
  '/agents — 查看可用助手',
  '/agents <序号|agentId> — 切换助手并开始新对话',
  '',
  '当前版本仅支持私聊文本消息。',
].join('\n')

/** 扫码绑定成功后的欢迎语（首条入站消息时可发送）。 */
export function buildWechatWelcomeText(agentTitle: string) {
  const name = agentTitle.trim() || '助手'
  return [
    `你好，我是「${name}」。`,
    '扫码绑定已成功，可以直接发消息和我对话。',
    '',
    '发送 /h 查看全部指令。',
  ].join('\n')
}

export function parseWechatCommand(input: string): { argument: string; name: string } | null {
  const match = input.trim().match(/^\/([a-z]+)(?:[ \t]+([^\r\n]+))?$/i)
  if (!match) return null
  const name = match[1]!.toLowerCase()
  return { argument: match[2]?.trim() ?? '', name: name === 'h' ? 'help' : name }
}
