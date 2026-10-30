import type { DesktopApi } from '@/types/desktop'

import { ipcRenderer } from 'electron'

import { DESKTOP_IPC_EVENTS } from '../common/ipc/contracts'
import { invoke } from './invoke'

const subscribe = <Payload>(eventName: string, listener: (payload: Payload) => void) => {
  const handler = (_event: Electron.IpcRendererEvent, payload: Payload) => listener(payload)
  ipcRenderer.on(eventName, handler)
  return () => ipcRenderer.removeListener(eventName, handler)
}

export const createDesktopApi = (): DesktopApi => ({
  zoom: {
    getFactor: () => invoke('window.getZoomFactor'),
    adjust: (input) => invoke('window.adjustZoom', input),
  },
  browser: {
    open: (input) => invoke('browser.open', input),
    navigate: (input) => invoke('browser.navigate', input),
    back: (input) => invoke('browser.back', input),
    forward: (input) => invoke('browser.forward', input),
    reload: (input) => invoke('browser.reload', input),
    stop: (input) => invoke('browser.stop', input),
    layout: (input) => invoke('browser.layout', input),
    capture: (input) => invoke('browser.capture', input),
    openExternal: (input) => invoke('browser.openExternal', input),
    pick: (input) => invoke('browser.pick', input),
    cancelPick: (input) => invoke('browser.cancelPick', input),
    close: (input) => invoke('browser.close', input),
    reset: () => invoke('browser.reset'),
    onStateChange: (listener) => subscribe(DESKTOP_IPC_EVENTS.browserState, listener),
  },
  terminal: {
    open: (input) => invoke('terminal.open', input),
    write: (input) => invoke('terminal.write', input),
    resize: (input) => invoke('terminal.resize', input),
    kill: (input) => invoke('terminal.kill', input),
    onData: (listener) => subscribe(DESKTOP_IPC_EVENTS.terminalData, listener),
    onExit: (listener) => subscribe(DESKTOP_IPC_EVENTS.terminalExit, listener),
  },
  updater: {
    getState: () => invoke('updater.getState'),
    getLogs: () => invoke('updater.getLogs'),
    clearLogs: () => invoke('updater.clearLogs'),
    check: () => invoke('updater.check'),
    clearCache: () => invoke('updater.clearCache'),
    setPreferences: (preferences) => invoke('updater.setPreferences', preferences),
    install: () => invoke('updater.install'),
    onStateChange: (listener) => subscribe(DESKTOP_IPC_EVENTS.updateState, listener),
  },
  openDevTools: () => invoke('window.openDevTools'),
  getDataInfo: () => invoke('data.getInfo'),
  getConfigSnapshot: () => invoke('config.getSnapshot'),
  openDataDirectory: (directory) => invoke('data.openDirectory', directory),
  setLogRetentionDays: (days) => invoke('data.setLogRetention', days),
  clearHttpCache: () => invoke('data.clearHttpCache'),
  chooseDirectory: () => invoke('dialog.chooseDirectory'),
  chooseFile: () => invoke('dialog.chooseFile'),
  createProject: (input) => invoke('project.create', input),
  deleteProject: (id) => invoke('project.delete', id),
  deleteSecret: (key) => invoke('storage.deleteSecret', key),
  executeLocalTool: (request) => invoke('localSystem.execute', request),
  cancelLocalCommand: (request) => invoke('localSystem.cancel', request),
  getAppInfo: () => invoke('app.getInfo'),
  getSystemMetrics: () => invoke('app.getSystemMetrics'),
  getWindowState: () => invoke('window.getState'),
  getSystemTools: () => invoke('app.getSystemTools'),
  lmStudio: {
    clearLegacySettings: (input) => invoke('lmstudio.settings.clearLegacy', input),
    getRuntimeConfig: (input) => invoke('lmstudio.settings.getRuntimeConfig', input),
  },
  getPermissionScope: (topicId) => invoke('permission.getScope', topicId),
  getRemoteServer: () => invoke('config.getRemoteServer'),
  getCloudServer: () => invoke('config.getCloudServer'),
  listProjectEntries: (input) => invoke('project.listEntries', input),
  readProjectFile: (input) => invoke('project.readFile', input),
  listProjects: () => invoke('project.list'),
  getDefaultProject: () => invoke('project.getDefault'),
  setDefaultProject: (id) => invoke('project.setDefault', id),
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
    onStatusChange: (listener) => subscribe(DESKTOP_IPC_EVENTS.authStatus, listener),
    start: (input) => invoke('auth.start', input),
  },
})
