import { isDangerousCommand } from '@/libs/commandSafety'

export const assertCommandAllowed = (command: string, mode: 'ask' | 'auto' | 'full') => {
  if (isDangerousCommand(command)) throw new Error('命令命中系统安全黑名单')
  if (mode !== 'full' && /(^|\s)(curl|wget|nc|ssh|scp)(\s|$)/i.test(command)) {
    throw new Error('联网或远程命令需要完全访问权限')
  }
}
