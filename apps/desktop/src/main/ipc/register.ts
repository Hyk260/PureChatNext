import { app } from 'electron'

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

export const registerDesktopIpc = async (options: {
  config?: DesktopConfigService
  getTrustedContents: () => Electron.WebContents | null
  rendererUrl: string
  auth?: DesktopAuthService
}) => {
  const config = options.config ?? new DesktopConfigService(app.getPath('userData'))
  const permissions = new PermissionService(
    PermissionController.createConfirmation(),
    PermissionController.createToolConfirmation()
  )
  const commands = new CommandService(permissions)
  const tools = new LocalToolService(config, permissions, commands)
  const registry = new IpcRegistry(options.getTrustedContents, options.rendererUrl)
  const auth = options.auth ?? new DesktopAuthService(config, (status) => {
    const contents = options.getTrustedContents()
    if (contents && !contents.isDestroyed()) contents.send('auth.status', status)
  })

  new ConfigController(config).register(registry)
  new AuthController(auth).register(registry)
  new StorageController(config).register(registry)
  new DialogController().register(registry)
  new PermissionController(config, permissions).register(registry)
  new ProjectController(config).register(registry)
  new LocalSystemController(tools).register(registry)
  new SystemController().register(registry)
  new WindowController().register(registry)

  return {
    dispose: () => {
      tools.dispose()
      permissions.dispose()
      registry.unregisterAll()
    },
    getRemoteServerUrl: async () => (await config.read()).remoteServerUrl,
    getAuthorizationHeader: () => auth.getAuthorizationHeader(),
    auth,
  }
}
