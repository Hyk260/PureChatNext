import { app } from 'electron'

import {
  ConfigController,
  DialogController,
  LocalSystemController,
  PermissionController,
  StorageController,
  SystemController,
} from '../controllers'
import { CommandService } from '../services/CommandService'
import { DesktopConfigService } from '../services/DesktopConfigService'
import { LocalToolService } from '../services/LocalToolService'
import { PermissionService } from '../services/PermissionService'
import { IpcRegistry } from './IpcRegistry'

export const registerDesktopIpc = async (options: {
  getTrustedContents: () => Electron.WebContents | null
  rendererUrl: string
}) => {
  const config = new DesktopConfigService(app.getPath('userData'))
  const permissions = new PermissionService(
    PermissionController.createConfirmation(),
    PermissionController.createToolConfirmation()
  )
  const commands = new CommandService(permissions)
  const tools = new LocalToolService(config, permissions, commands)
  const registry = new IpcRegistry(options.getTrustedContents, options.rendererUrl)

  new ConfigController(config).register(registry)
  new StorageController(config).register(registry)
  new DialogController().register(registry)
  new PermissionController(config, permissions).register(registry)
  new LocalSystemController(tools).register(registry)
  new SystemController().register(registry)

  return {
    dispose: () => {
      tools.dispose()
      permissions.dispose()
      registry.unregisterAll()
    },
    getRemoteServerUrl: async () => (await config.read()).remoteServerUrl,
  }
}
