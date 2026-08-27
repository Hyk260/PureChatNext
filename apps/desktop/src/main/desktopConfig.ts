/** @deprecated Configuration ownership moved to ./services/DesktopConfigService. */
export {
  DEFAULT_CONFIG,
  DesktopConfigService as DesktopConfigStore,
  normalizeRemoteServerUrl,
} from './services/DesktopConfigService'
export type { DesktopConfig } from './services/DesktopConfigService'

import { DesktopConfigService } from './services/DesktopConfigService'
import type { DesktopConfig } from './services/DesktopConfigService'

export const createConfigStore = async (userDataPath: string) => {
  const service = new DesktopConfigService(userDataPath)
  return {
    configPath: service.configPath,
    read: () => service.read(),
    write: (config: DesktopConfig) => service.write(config),
  }
}
