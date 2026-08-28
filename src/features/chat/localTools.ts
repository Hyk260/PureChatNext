import type { DesktopLocalToolRequest } from '@/types/desktop'

export type LocalToolName = DesktopLocalToolRequest['toolName']

const LOCAL_TOOL_NAME_LIST = [
  'editFile',
  'getCommandOutput',
  'getSystemInfo',
  'killCommand',
  'listFiles',
  'moveFile',
  'readFile',
  'runCommand',
  'searchFiles',
  'writeFile',
] as const satisfies readonly LocalToolName[]

const SAFE_LOCAL_TOOL_NAME_LIST = [
  'getCommandOutput',
  'getSystemInfo',
  'listFiles',
  'readFile',
  'searchFiles',
] as const satisfies readonly LocalToolName[]

/** String set so `.has(toolName: string)` stays ergonomic at call sites. */
export const LOCAL_TOOL_NAMES: ReadonlySet<string> = new Set(LOCAL_TOOL_NAME_LIST)

export const SAFE_LOCAL_TOOL_NAMES: ReadonlySet<string> = new Set(SAFE_LOCAL_TOOL_NAME_LIST)

export const isLocalToolName = (name: string): name is LocalToolName => LOCAL_TOOL_NAMES.has(name)
