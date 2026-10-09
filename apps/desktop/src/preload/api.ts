import type { DesktopApi } from '@/types/desktop'

import { ipcRenderer } from 'electron'

import { DESKTOP_IPC_EVENTS } from '../common/ipc/contracts'
import { invoke } from './invoke'

export const createDesktopApi = (): DesktopApi => ({
  chooseDirectory: () => invoke('dialog.chooseDirectory'),
  chooseFile: () => invoke('dialog.chooseFile'),
  createProject: (input) => invoke('project.create', input),
  deleteProject: (id) => invoke('project.delete', id),
  deleteSecret: (key) => invoke('storage.deleteSecret', key),
  executeLocalTool: (request) => invoke('localSystem.execute', request),
  getAppInfo: () => invoke('app.getInfo'),
  getWindowState: () => invoke('window.getState'),
  getSystemTools: () => invoke('app.getSystemTools'),
  getPermissionScope: (topicId) => invoke('permission.getScope', topicId),
  getRemoteServer: () => invoke('config.getRemoteServer'),
  getCloudServer: () => invoke('config.getCloudServer'),
  listProjectEntries: (input) => invoke('project.listEntries', input),
  listProjects: () => invoke('project.list'),
  notify: (input) => invoke('notification.show', input),
  minimizeWindow: () => invoke('window.minimize'),
  toggleMaximizeWindow: () => invoke('window.toggleMaximize'),
  closeWindow: () => invoke('window.close'),
  openExternal: (url) => invoke('window.openExternal', url),
  openPath: (targetPath) => invoke('shell.openPath', targetPath),
  requestFullAccess: (topicId) => invoke('permission.requestFull', topicId),
  setPermissionScope: (topicId, scope) => invoke('permission.setScope', topicId, scope),
  setRemoteServer: (url) => invoke('config.setRemoteServer', url),
  storeSecret: (key, value) => invoke('storage.storeSecret', key, value),
  auth: {
    cancel: () => invoke('auth.cancel'),
    getStatus: () => invoke('auth.getStatus'),
    logout: () => invoke('auth.logout'),
    onStatusChange: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, status: Parameters<typeof listener>[0]) => listener(status)
      ipcRenderer.on(DESKTOP_IPC_EVENTS.authStatus, handler)
      return () => ipcRenderer.removeListener(DESKTOP_IPC_EVENTS.authStatus, handler)
    },
    start: (input) => invoke('auth.start', input),
  },
})
