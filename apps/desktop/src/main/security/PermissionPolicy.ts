import type { ChatPermissionMode } from '@pure/types'

export type DesktopToolRisk = 'read' | 'network' | 'write' | 'command' | 'dangerous'

export const requiresNativeApproval = (mode: ChatPermissionMode, risk: DesktopToolRisk) => {
  if (risk === 'dangerous') return true
  if (mode === 'full') return false
  return risk !== 'read'
}

export const isRiskAllowed = (mode: ChatPermissionMode, risk: DesktopToolRisk) => risk !== 'dangerous'
