import type { ChatPermissionMode } from '@pure/types'

export interface DesktopAppInfo {
  isPackaged: boolean
  platform: NodeJS.Platform
  version: string
}

export interface DesktopRemoteServer {
  url: string | null
}

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
  createProject: (input: { name: string; rootPath: string }) => Promise<DesktopProject>
  deleteProject: (id: string) => Promise<void>
  deleteSecret: (key: string) => Promise<void>
  getAppInfo: () => Promise<DesktopAppInfo>
  getRemoteServer: () => Promise<DesktopRemoteServer>
  listProjectEntries: (input: { projectId: string; relativePath?: string }) => Promise<DesktopProjectEntries>
  listProjects: () => Promise<DesktopProject[]>
  notify: (input: DesktopNotificationInput) => Promise<void>
  executeLocalTool: (request: DesktopLocalToolRequest) => Promise<DesktopLocalToolResult>
  getPermissionScope: (topicId: string) => Promise<{ scope: string | null }>
  requestFullAccess: (topicId: string) => Promise<{ granted: boolean }>
  setPermissionScope: (topicId: string, scope: string) => Promise<{ scope: string }>
  openExternal: (url: string) => Promise<void>
  openPath: (targetPath: string) => Promise<void>
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
