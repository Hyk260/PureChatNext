const blockedCommands = [
  /(^|\s)sudo(\s|$)/i,
  /(^|\s)rm\s+(-[rf]+\s+)*\/(\s|$)/i,
  /:\(\)\s*\{.*:\|:.*\}/,
  /(^|\s)dd\s+if=/i,
  /(^|\s)mkfs(\s|$)/i,
  /(^|\s)(shutdown|reboot)(\s|$)/i,
]

export const assertCommandAllowed = (command: string, mode: 'ask' | 'auto' | 'full') => {
  if (blockedCommands.some((pattern) => pattern.test(command))) throw new Error('命令命中系统安全黑名单')
  if (mode !== 'full' && /(^|\s)(curl|wget|nc|ssh|scp)(\s|$)/i.test(command)) {
    throw new Error('联网或远程命令需要完全访问权限')
  }
}
