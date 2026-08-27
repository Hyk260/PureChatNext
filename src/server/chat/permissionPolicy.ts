import type { ChatPermissionMode } from '@pure/types'

export type ToolExecutionTarget = 'desktop' | 'server'
export type ToolRisk = 'dangerous' | 'network' | 'read' | 'write'

export type ToolCapability = {
  apiName: string
  execution: ToolExecutionTarget
  identifier: string
  risk: ToolRisk
}

export const CHAT_TOOL_CAPABILITIES: readonly ToolCapability[] = [
  { apiName: 'webSearch', execution: 'server', identifier: 'builtin-web-search', risk: 'network' },
  { apiName: 'getWeather', execution: 'server', identifier: 'builtin-weather', risk: 'network' },
  { apiName: 'readFile', execution: 'desktop', identifier: 'desktop-local-system', risk: 'read' },
  { apiName: 'listFiles', execution: 'desktop', identifier: 'desktop-local-system', risk: 'read' },
  { apiName: 'searchFiles', execution: 'desktop', identifier: 'desktop-local-system', risk: 'read' },
  { apiName: 'getSystemInfo', execution: 'desktop', identifier: 'desktop-local-system', risk: 'read' },
  { apiName: 'writeFile', execution: 'desktop', identifier: 'desktop-local-system', risk: 'write' },
  { apiName: 'editFile', execution: 'desktop', identifier: 'desktop-local-system', risk: 'write' },
  { apiName: 'moveFile', execution: 'desktop', identifier: 'desktop-local-system', risk: 'write' },
  { apiName: 'runCommand', execution: 'desktop', identifier: 'desktop-local-system', risk: 'dangerous' },
  { apiName: 'getCommandOutput', execution: 'desktop', identifier: 'desktop-local-system', risk: 'read' },
  { apiName: 'killCommand', execution: 'desktop', identifier: 'desktop-local-system', risk: 'dangerous' },
]

const ALWAYS_BLOCKED_COMMANDS = [
  /(^|\s)sudo(\s|$)/i,
  /(^|\s)rm\s+(-[rf]+\s+)*\/(\s|$)/i,
  /(^|\s)mkfs(\s|$)/i,
  /(^|\s)shutdown(\s|$)/i,
  /(^|\s)reboot(\s|$)/i,
  /:\(\)\s*\{.*:\|:.*\}/,
  /(^|\s)dd\s+if=/i,
]

const capabilityKey = (identifier: string, apiName: string) => `${identifier}/${apiName}`

export const findToolCapability = (identifier: string, apiName: string) =>
  CHAT_TOOL_CAPABILITIES.find((capability) => capability.identifier === identifier && capability.apiName === apiName)

export const isDangerousCommand = (command: string) => ALWAYS_BLOCKED_COMMANDS.some((pattern) => pattern.test(command))

export const isToolApprovalRequired = ({
  apiName,
  args,
  identifier,
  mode,
}: {
  apiName: string
  args?: Record<string, unknown>
  identifier: string
  mode: ChatPermissionMode
}) => {
  const capability = findToolCapability(identifier, apiName)
  if (!capability) return { decision: 'user-approval' as const, reason: '未知工具需要确认' }

  if (capability.apiName === 'runCommand' && typeof args?.command === 'string' && isDangerousCommand(args.command)) {
    return { decision: 'denied' as const, reason: '命令命中系统安全黑名单' }
  }

  if (mode === 'full') return { decision: 'approved' as const }
  if (mode === 'ask') return { decision: 'user-approval' as const }

  if (capability.risk === 'read') return { decision: 'approved' as const }
  return { decision: 'user-approval' as const, reason: '检测到可能影响数据或隐私的操作' }
}

export const getCapabilityKey = (identifier: string, apiName: string) => capabilityKey(identifier, apiName)
