import type { DesktopApi } from '../../../../src/types/desktop'

import { invoke } from './invoke'

export const createDesktopApi = (): DesktopApi => ({
  chooseDirectory: () => invoke('dialog.chooseDirectory'),
  chooseFile: () => invoke('dialog.chooseFile'),
  createProject: (input) => invoke('project.create', input),
  deleteProject: (id) => invoke('project.delete', id),
  deleteSecret: (key) => invoke('storage.deleteSecret', key),
  executeLocalTool: (request) => invoke('localSystem.execute', request),
  getAppInfo: () => invoke('app.getInfo'),
  getPermissionScope: (topicId) => invoke('permission.getScope', topicId),
  getRemoteServer: () => invoke('config.getRemoteServer'),
  listProjectEntries: (input) => invoke('project.listEntries', input),
  listProjects: () => invoke('project.list'),
  notify: (input) => invoke('notification.show', input),
  openExternal: (url) => invoke('window.openExternal', url),
  openPath: (targetPath) => invoke('shell.openPath', targetPath),
  requestFullAccess: (topicId) => invoke('permission.requestFull', topicId),
  setPermissionScope: (topicId, scope) => invoke('permission.setScope', topicId, scope),
  setRemoteServer: (url) => invoke('config.setRemoteServer', url),
  storeSecret: (key, value) => invoke('storage.storeSecret', key, value),
})
