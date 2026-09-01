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

/** User-facing approval titles — ask what the action does, not the API name. */
const LOCAL_TOOL_APPROVAL_TITLE = {
  editFile: '允许编辑文件？',
  getCommandOutput: '允许查看命令输出？',
  getSystemInfo: '允许读取系统信息？',
  killCommand: '允许终止命令？',
  listFiles: '允许查看文件夹内容？',
  moveFile: '允许移动文件？',
  readFile: '允许读取文件？',
  runCommand: '允许运行这条命令？',
  searchFiles: '允许搜索文件？',
  writeFile: '允许写入文件？',
} as const satisfies Record<LocalToolName, string>

const OTHER_TOOL_APPROVAL_TITLE: Record<string, string> = {
  getWeather: '允许查询天气？',
  weather: '允许查询天气？',
  webSearch: '允许联网搜索？',
}

/** String set so `.has(toolName: string)` stays ergonomic at call sites. */
export const LOCAL_TOOL_NAMES: ReadonlySet<string> = new Set(LOCAL_TOOL_NAME_LIST)

export const SAFE_LOCAL_TOOL_NAMES: ReadonlySet<string> = new Set(SAFE_LOCAL_TOOL_NAME_LIST)

export const isLocalToolName = (name: string): name is LocalToolName => LOCAL_TOOL_NAMES.has(name)

/** Chinese permission question for approval cards. Unknown tools stay generic. */
export const getToolApprovalTitle = (toolName: string) => {
  if (isLocalToolName(toolName)) return LOCAL_TOOL_APPROVAL_TITLE[toolName]
  return OTHER_TOOL_APPROVAL_TITLE[toolName] ?? '允许执行此操作？'
}
