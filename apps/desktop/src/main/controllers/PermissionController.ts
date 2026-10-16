import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { IpcRegistry } from '../ipc/IpcRegistry'
import type { DesktopConfigService } from '../services/DesktopConfigService'
import type { PermissionService } from '../services/PermissionService'
import { assertNotSensitive } from '../security/PathPolicy'

export class PermissionController {
  constructor(
    private readonly config: DesktopConfigService,
    private readonly permissions: PermissionService
  ) {}

  register(ipc: IpcRegistry) {
    ipc.register('permission.getScope', async (topicId) => {
      if (!topicId || topicId.length > 200) throw new Error('话题标识无效')
      const config = await this.config.read()
      return { scope: config.permissionScopes[topicId]?.[0] ?? null }
    })
    ipc.register('permission.requestFull', (topicId) => {
      if (!topicId || topicId.length > 200) throw new Error('话题标识无效')
      return this.permissions.requestFullAccess(topicId)
    })
    ipc.register('permission.setScope', async (topicId, scope) => {
      if (!topicId || topicId.length > 200 || !path.isAbsolute(scope)) throw new Error('权限范围无效')
      const absolute = path.resolve(scope)
      const resolved = await fs.realpath(absolute).catch(() => absolute)
      if (!(await fs.stat(resolved)).isDirectory()) throw new Error('权限范围必须是目录')
      assertNotSensitive(resolved)
      return this.config.setPermissionScope(topicId, resolved)
    })
  }
}
