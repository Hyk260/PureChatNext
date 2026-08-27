import type { ChatPermissionMode } from '@pure/types'

export interface DesktopAppInfo {
  isPackaged: boolean
  platform: NodeJS.Platform
  version: string
}

export interface DesktopRemoteServer {
  url: string | null
}

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
  success: boolean
}

export interface DesktopApi {
  chooseFile: () => Promise<DesktopFileSelection | null>
  chooseDirectory: () => Promise<string | null>
  deleteSecret: (key: string) => Promise<void>
  getAppInfo: () => Promise<DesktopAppInfo>
  getRemoteServer: () => Promise<DesktopRemoteServer>
  notify: (input: DesktopNotificationInput) => Promise<void>
  executeLocalTool: (request: DesktopLocalToolRequest) => Promise<DesktopLocalToolResult>
  requestFullAccess: (topicId: string) => Promise<{ granted: boolean }>
  setPermissionScope: (topicId: string, scope: string) => Promise<{ scope: string }>
  openExternal: (url: string) => Promise<void>
  setRemoteServer: (url: string) => Promise<DesktopRemoteServer>
  storeSecret: (key: string, value: string) => Promise<void>
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
