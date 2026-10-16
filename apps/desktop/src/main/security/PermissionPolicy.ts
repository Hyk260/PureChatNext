import type { ChatPermissionMode } from '@pure/types'
import { isLowRiskCommand } from '@/libs/commandSafety'

export type DesktopToolRisk = 'read' | 'network' | 'write' | 'command' | 'dangerous'

export const requiresApproval = (mode: ChatPermissionMode, risk: DesktopToolRisk, command?: string) => {
  if (risk === 'dangerous') return true
  if (mode === 'full') return false
  if (mode === 'auto' && risk === 'command' && command && isLowRiskCommand(command)) return false
  return risk !== 'read'
}

export const isRiskAllowed = (mode: ChatPermissionMode, risk: DesktopToolRisk) => risk !== 'dangerous'
