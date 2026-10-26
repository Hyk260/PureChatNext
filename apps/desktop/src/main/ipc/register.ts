import { app } from 'electron'

import { DataController } from '../controllers/DataController'
import { DesktopDataService } from '../services/DesktopDataService'
import { UpdateController } from '../controllers/UpdateController'
import type { UpdateService } from '../services/UpdateService'

import {
  ConfigController,
  DialogController,
  LocalSystemController,
  PermissionController,
  ProjectController,
  StorageController,
  SystemController,
  WindowController,
} from '../controllers'
import { CommandService } from '../services/CommandService'
import { AuthController } from '../controllers/AuthController'
import { DesktopConfigService } from '../services/DesktopConfigService'
import { DesktopAuthService } from '../services/DesktopAuthService'
import { LocalToolService } from '../services/LocalToolService'
import { PermissionService } from '../services/PermissionService'
import { IpcRegistry } from './IpcRegistry'
import { TerminalService } from '../services/TerminalService'
import { TerminalController } from '../controllers/TerminalController'
import { DESKTOP_IPC_EVENTS } from '../../common/ipc/contracts'
import { BrowserController } from '../controllers/BrowserController'
import { BrowserService } from '../services/BrowserService'

export const registerDesktopIpc = async (options: {
  config?: DesktopConfigService
  getTrustedContents: () => Electron.WebContents | null
  rendererUrl: string
  auth?: DesktopAuthService
  updater: UpdateService
}) => {
  const config = options.config ?? new DesktopConfigService(app.getPath('userData'))
  const permissions = new PermissionService()
  const commands = new CommandService(permissions)
  const tools = new LocalToolService(config, permissions, commands)
  const registry = new IpcRegistry(options.getTrustedContents, options.rendererUrl)
  const browser = new BrowserService((owner, state) => {
    if (!owner.isDestroyed()) owner.send(DESKTOP_IPC_EVENTS.browserState, state)
  })
  const browserController = new BrowserController(browser, options.getTrustedContents)
  browserController.register(registry)
  const terminal = new TerminalService({
    config,
    desktopPath: app.getPath('desktop'),
    resourcesPath: app.isPackaged ? process.resourcesPath : undefined,
    onData: (owner, event) => {
      const contents = options.getTrustedContents()
      if (contents && !contents.isDestroyed() && contents.id === owner)
        contents.send(DESKTOP_IPC_EVENTS.terminalData, event)
    },
    onExit: (owner, event) => {
      const contents = options.getTrustedContents()
      if (contents && !contents.isDestroyed() && contents.id === owner)
        contents.send(DESKTOP_IPC_EVENTS.terminalExit, event)
    },
  })
  const terminalController = new TerminalController(terminal, options.getTrustedContents)
  terminalController.register(registry)
  const auth =
    options.auth ??
    new DesktopAuthService(config, (status) => {
      const contents = options.getTrustedContents()
      if (contents && !contents.isDestroyed()) contents.send('auth.status', status)
    })

  const data = new DesktopDataService(config, options.getTrustedContents)
  await data.start()
  new DataController(data).register(registry)

  new ConfigController(config, () => browser.reset()).register(registry)
  new AuthController(auth, () => {
    terminal.reset()
    browser.reset().catch(() => undefined)
  }).register(registry)
  new StorageController(config).register(registry)
  new DialogController().register(registry)
  new PermissionController(config, permissions).register(registry)
  new ProjectController(config).register(registry)
  new LocalSystemController(tools).register(registry)
  new SystemController().register(registry)
  new WindowController().register(registry)
  new UpdateController(options.updater).register(registry)

  return {
    dispose: () => {
      browserController.dispose()
      terminalController.dispose()
      data.dispose()
      tools.dispose()
      permissions.dispose()
      registry.unregisterAll()
    },
    getRemoteServerUrl: async () => (await config.read()).remoteServerUrl,
    resetTerminals: () => terminal.reset(),
    resetBrowsers: () => {
      browser.reset().catch(() => undefined)
    },
    getAuthorizationHeader: () => auth.getAuthorizationHeader(),
    auth,
  }
}
