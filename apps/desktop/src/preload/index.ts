import { contextBridge, ipcRenderer } from 'electron'

import type { DesktopApi } from '../../../../src/types/desktop'

const api: DesktopApi = {
  chooseFile: () => ipcRenderer.invoke('dialog:choose-file'),
  chooseDirectory: () => ipcRenderer.invoke('dialog:choose-directory'),
  deleteSecret: (key) => ipcRenderer.invoke('storage:delete-secret', key),
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  getRemoteServer: () => ipcRenderer.invoke('config:get-remote-server'),
  notify: (input) => ipcRenderer.invoke('notification:show', input),
  executeLocalTool: (request) => ipcRenderer.invoke('local-system:execute', request),
  requestFullAccess: (topicId) => ipcRenderer.invoke('permission:request-full', topicId),
  setPermissionScope: (topicId, scope) => ipcRenderer.invoke('permission:set-scope', topicId, scope),
  openExternal: (url) => ipcRenderer.invoke('window:open-external', url),
  setRemoteServer: (url) => ipcRenderer.invoke('config:set-remote-server', url),
  storeSecret: (key, value) => ipcRenderer.invoke('storage:store-secret', key, value),
}

contextBridge.exposeInMainWorld('pureChatDesktop', api)
