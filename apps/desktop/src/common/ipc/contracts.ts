import type {
  DesktopAppInfo,
  DesktopFileSelection,
  DesktopLocalToolRequest,
  DesktopLocalToolResult,
  DesktopNotificationInput,
  DesktopRemoteServer,
} from '../../../../../src/types/desktop'

export interface DesktopIpcContractMap {
  'app.getInfo': { args: []; result: DesktopAppInfo }
  'config.getRemoteServer': { args: []; result: DesktopRemoteServer }
  'config.setRemoteServer': { args: [value: string]; result: DesktopRemoteServer }
  'storage.deleteSecret': { args: [key: string]; result: void }
  'storage.storeSecret': { args: [key: string, value: string]; result: void }
  'dialog.chooseDirectory': { args: []; result: string | null }
  'dialog.chooseFile': { args: []; result: DesktopFileSelection | null }
  'permission.requestFull': { args: [topicId: string]; result: { granted: boolean } }
  'permission.setScope': { args: [topicId: string, scope: string]; result: { scope: string } }
  'localSystem.execute': { args: [request: DesktopLocalToolRequest]; result: DesktopLocalToolResult }
  'window.openExternal': { args: [url: string]; result: void }
  'notification.show': { args: [input: DesktopNotificationInput]; result: void }
}

export type DesktopIpcChannel = keyof DesktopIpcContractMap
export type DesktopIpcArgs<C extends DesktopIpcChannel> = DesktopIpcContractMap[C]['args']
export type DesktopIpcResult<C extends DesktopIpcChannel> = DesktopIpcContractMap[C]['result']

export const DESKTOP_IPC_CHANNELS = {
  app: { getInfo: 'app.getInfo' },
  config: { getRemoteServer: 'config.getRemoteServer', setRemoteServer: 'config.setRemoteServer' },
  dialog: { chooseDirectory: 'dialog.chooseDirectory', chooseFile: 'dialog.chooseFile' },
  localSystem: { execute: 'localSystem.execute' },
  notification: { show: 'notification.show' },
  permission: { requestFull: 'permission.requestFull', setScope: 'permission.setScope' },
  storage: { deleteSecret: 'storage.deleteSecret', storeSecret: 'storage.storeSecret' },
  window: { openExternal: 'window.openExternal' },
} as const
