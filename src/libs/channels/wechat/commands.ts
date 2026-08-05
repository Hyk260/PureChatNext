export const WECHAT_HELP_TEXT = [
  '可用指令：',
  '/help — 查看帮助',
  '/new — 取消当前生成并开始新对话',
  '/stop — 停止当前生成',
  '/agents — 查看可用助手',
  '/agents <序号|agentId> — 切换助手并开始新对话',
  '',
  '当前版本仅支持私聊文本消息。',
].join('\n')

export function parseWechatCommand(input: string): { argument: string; name: string } | null {
  const match = input.trim().match(/^\/([a-z]+)(?:[ \t]+([^\r\n]+))?$/i)
  if (!match) return null
  return { argument: match[2]?.trim() ?? '', name: match[1]!.toLowerCase() }
}
