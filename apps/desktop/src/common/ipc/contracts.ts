import type {
  DesktopAppInfo,
  DesktopAuthStatus,
  DesktopFileSelection,
  DesktopLocalToolRequest,
  DesktopLocalToolResult,
  DesktopNotificationInput,
  DesktopProject,
  DesktopProjectEntries,
  DesktopRemoteServer,
  DesktopSystemTools,
  DesktopWindowState,
} from '@/types/desktop'

export interface DesktopIpcContractMap {
  'app.getInfo': { args: []; result: DesktopAppInfo }
  'app.getSystemTools': { args: []; result: DesktopSystemTools }
  'config.getRemoteServer': { args: []; result: DesktopRemoteServer }
  'config.getCloudServer': { args: []; result: DesktopRemoteServer }
  'config.setRemoteServer': { args: [value: string]; result: DesktopRemoteServer }
  'auth.start': { args: [input: { serverUrl: string }]; result: DesktopAuthStatus }
  'auth.getStatus': { args: []; result: DesktopAuthStatus }
  'auth.cancel': { args: []; result: DesktopAuthStatus }
  'auth.logout': { args: []; result: DesktopAuthStatus }
  'storage.deleteSecret': { args: [key: string]; result: void }
  'storage.storeSecret': { args: [key: string, value: string]; result: void }
  'dialog.chooseDirectory': { args: []; result: string | null }
  'dialog.chooseFile': { args: []; result: DesktopFileSelection | null }
  'permission.getScope': { args: [topicId: string]; result: { scope: string | null } }
  'permission.requestFull': { args: [topicId: string]; result: { granted: boolean } }
  'permission.setScope': { args: [topicId: string, scope: string]; result: { scope: string } }
  'project.create': { args: [input: { name: string; rootPath: string }]; result: DesktopProject }
  'project.delete': { args: [id: string]; result: void }
  'project.list': { args: []; result: DesktopProject[] }
  'project.listEntries': {
    args: [input: { projectId: string; relativePath?: string }]
    result: DesktopProjectEntries
  }
  'localSystem.execute': { args: [request: DesktopLocalToolRequest]; result: DesktopLocalToolResult }
  'shell.openPath': { args: [targetPath: string]; result: void }
  'window.openExternal': { args: [url: string]; result: void }
  'window.getState': { args: []; result: DesktopWindowState }
  'window.minimize': { args: []; result: void }
  'window.toggleMaximize': { args: []; result: DesktopWindowState }
  'window.close': { args: []; result: void }
  'notification.show': { args: [input: DesktopNotificationInput]; result: void }
}

export type DesktopIpcChannel = keyof DesktopIpcContractMap
export type DesktopIpcArgs<C extends DesktopIpcChannel> = DesktopIpcContractMap[C]['args']
export type DesktopIpcResult<C extends DesktopIpcChannel> = DesktopIpcContractMap[C]['result']

export const DESKTOP_IPC_CHANNELS = {
  app: { getInfo: 'app.getInfo', getSystemTools: 'app.getSystemTools' },
  auth: { cancel: 'auth.cancel', getStatus: 'auth.getStatus', logout: 'auth.logout', start: 'auth.start' },
  config: {
    getCloudServer: 'config.getCloudServer',
    getRemoteServer: 'config.getRemoteServer',
    setRemoteServer: 'config.setRemoteServer',
  },
  dialog: { chooseDirectory: 'dialog.chooseDirectory', chooseFile: 'dialog.chooseFile' },
  localSystem: { execute: 'localSystem.execute' },
  notification: { show: 'notification.show' },
  permission: {
    getScope: 'permission.getScope',
    requestFull: 'permission.requestFull',
    setScope: 'permission.setScope',
  },
  project: {
    create: 'project.create',
    delete: 'project.delete',
    list: 'project.list',
    listEntries: 'project.listEntries',
  },
  shell: { openPath: 'shell.openPath' },
  storage: { deleteSecret: 'storage.deleteSecret', storeSecret: 'storage.storeSecret' },
  window: {
    close: 'window.close',
    getState: 'window.getState',
    minimize: 'window.minimize',
    openExternal: 'window.openExternal',
    toggleMaximize: 'window.toggleMaximize',
  },
} as const

export const DESKTOP_IPC_EVENTS = {
  authStatus: 'auth.status',
} as const
