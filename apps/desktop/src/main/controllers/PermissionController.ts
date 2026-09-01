import { promises as fs } from 'node:fs'
import path from 'node:path'

import { dialog } from 'electron'

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

  static createConfirmation() {
    return async () => {
      const confirmation = await dialog.showMessageBox({
        buttons: ['取消', '确认'],
        cancelId: 0,
        defaultId: 0,
        detail: 'PureChat 将可以在未经逐次许可的情况下访问文件、运行命令和使用联网工具。危险系统操作仍会被阻止。',
        message: '要开启完全访问权限吗？',
        noLink: true,
        type: 'warning',
      })
      return confirmation.response === 1
    }
  }

  static createToolConfirmation() {
    return async (description: string) => {
      const confirmation = await dialog.showMessageBox({
        buttons: ['取消', '确认'],
        cancelId: 0,
        defaultId: 0,
        detail: `${description}\n此操作由桌面主进程再次确认。`,
        message: '要允许此桌面操作吗？',
        noLink: true,
        type: 'warning',
      })
      return confirmation.response === 1
    }
  }
}
