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

export interface DesktopApi {
  chooseFile: () => Promise<DesktopFileSelection | null>
  deleteSecret: (key: string) => Promise<void>
  getAppInfo: () => Promise<DesktopAppInfo>
  getRemoteServer: () => Promise<DesktopRemoteServer>
  notify: (input: DesktopNotificationInput) => Promise<void>
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
