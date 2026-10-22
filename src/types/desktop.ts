import type { ChatPermissionMode } from '@pure/types'
import type { DesktopUpdateLogs, DesktopUpdatePreferences, DesktopUpdateState } from './desktopUpdater'

export type { DesktopUpdatePreferences, DesktopUpdateState } from './desktopUpdater'

export interface DesktopAppInfo {
  isPackaged: boolean
  platform: NodeJS.Platform
  version: string
}

export interface DesktopWindowState {
  isMaximized: boolean
}

export interface DesktopBuiltinTool {
  description: string
  id: string
  name: string
  version: string
}

export interface DesktopRuntimeTool {
  available: boolean
  description: string
  id: string
  name: string
  path: string | null
  version: string | null
}

export interface DesktopSystemTools {
  builtin: DesktopBuiltinTool[]
  runtime: DesktopRuntimeTool[]
}

export interface DesktopRemoteServer {
  url: string | null
}

export type DesktopAuthStatus =
  | { status: 'signedOut' }
  | { expiresAt: number; status: 'waiting' }
  | { status: 'signedIn' }
  | { message: string; status: 'error' }

export type DesktopAuthStatusListener = (status: DesktopAuthStatus) => void

export interface DesktopProject {
  createdAt: number
  id: string
  name: string
  rootPath: string
}

export interface DesktopProjectEntry {
  isDirectory: boolean
  name: string
}

export interface DesktopProjectEntries {
  entries: DesktopProjectEntry[]
  path: string
}

export type DesktopProjectFile = {
  name: string
  path: string
  size: number
} & ({ kind: 'text'; content: string } | { kind: 'image'; dataUrl: string } | { kind: 'unsupported'; reason: string })

export interface DesktopFileSelection {
  name: string
  path: string
}

export interface DesktopNotificationInput {
  body?: string
  title: string
}

export type DesktopPermissionMode = ChatPermissionMode

export type DesktopLocalToolRequest = {
  approved?: boolean
  args: Record<string, unknown>
  mode: DesktopPermissionMode
  toolCallId: string
  toolName:
    | 'editFile'
    | 'getSystemInfo'
    | 'getCommandOutput'
    | 'killCommand'
    | 'listFiles'
    | 'moveFile'
    | 'readFile'
    | 'runCommand'
    | 'searchFiles'
    | 'writeFile'
  topicId: string
}

export type DesktopLocalToolResult = {
  content: string
  data?: unknown
  execution?: DesktopCommandExecution
  success: boolean
}

export interface DesktopCommandExecution {
  command: string
  cwd: string
  durationMs: number
  exitCode: number | null
  output: string
  shellId: string
  signal: string | null
  startedAt: number
  status: 'cancelled' | 'completed' | 'failed' | 'timedOut'
  truncated: boolean
}

export interface DesktopLocalCommandCancellation {
  topicId: string
  toolCallId: string
}

export type DesktopLogRetentionDays = 0 | 7 | 14 | 30 | 90
export type DesktopDataDirectory = 'data' | 'logs'

export interface DesktopDataInfo {
  dataPath: string
  logsPath: string
  logRetentionDays: DesktopLogRetentionDays
  cacheBytes: number | null
}

export interface DesktopApi {
  updater: {
    getState: () => Promise<DesktopUpdateState>
    getLogs: () => Promise<DesktopUpdateLogs>
    clearLogs: () => Promise<void>
    check: () => Promise<DesktopUpdateState>
    clearCache: () => Promise<DesktopUpdateState>
    setPreferences: (preferences: DesktopUpdatePreferences) => Promise<DesktopUpdateState>
    install: () => Promise<void>
    onStateChange: (listener: (state: DesktopUpdateState) => void) => () => void
  }
  openDevTools: () => Promise<void>
  getDataInfo: () => Promise<DesktopDataInfo>
  openDataDirectory: (directory: DesktopDataDirectory) => Promise<void>
  setLogRetentionDays: (days: DesktopLogRetentionDays) => Promise<void>
  clearHttpCache: () => Promise<void>
  chooseFile: () => Promise<DesktopFileSelection | null>
  chooseDirectory: () => Promise<string | null>
  createProject: (input: { name: string; rootPath: string }) => Promise<DesktopProject>
  deleteProject: (id: string) => Promise<void>
  deleteSecret: (key: string) => Promise<void>
  getAppInfo: () => Promise<DesktopAppInfo>
  getWindowState: () => Promise<DesktopWindowState>
  getSystemTools: () => Promise<DesktopSystemTools>
  getRemoteServer: () => Promise<DesktopRemoteServer>
  getCloudServer: () => Promise<DesktopRemoteServer>
  listProjectEntries: (input: { projectId: string; relativePath?: string }) => Promise<DesktopProjectEntries>
  readProjectFile: (input: { projectId: string; relativePath: string }) => Promise<DesktopProjectFile>
  listProjects: () => Promise<DesktopProject[]>
  getDefaultProject: () => Promise<DesktopProject | null>
  setDefaultProject: (id: string | null) => Promise<DesktopProject | null>
  notify: (input: DesktopNotificationInput) => Promise<void>
  minimizeWindow: () => Promise<void>
  toggleMaximizeWindow: () => Promise<DesktopWindowState>
  closeWindow: () => Promise<void>
  executeLocalTool: (request: DesktopLocalToolRequest) => Promise<DesktopLocalToolResult>
  cancelLocalCommand: (request: DesktopLocalCommandCancellation) => Promise<void>
  getPermissionScope: (topicId: string) => Promise<{ scope: string | null }>
  requestFullAccess: (topicId: string) => Promise<{ granted: boolean }>
  setPermissionScope: (topicId: string, scope: string | null) => Promise<{ scope: string | null }>
  openExternal: (url: string) => Promise<void>
  openPath: (targetPath: string) => Promise<void>
  setRemoteServer: (url: string) => Promise<DesktopRemoteServer>
  storeSecret: (key: string, value: string) => Promise<void>
  auth: {
    start: (input: { serverUrl: string }) => Promise<DesktopAuthStatus>
    getStatus: () => Promise<DesktopAuthStatus>
    cancel: () => Promise<DesktopAuthStatus>
    logout: () => Promise<DesktopAuthStatus>
    onStatusChange: (listener: DesktopAuthStatusListener) => () => void
  }
}

declare global {
  interface Window {
    pureChatDesktop?: DesktopApi
  }
}

export const getDesktopApi = (): DesktopApi | undefined => {
  if (typeof window === 'undefined') return undefined
  return window.pureChatDesktop
}

export {}
