import { promises as fs } from 'node:fs'
import path from 'node:path'

import { app, dialog, ipcMain, Notification, safeStorage, shell } from 'electron'

import { createConfigStore, normalizeRemoteServerUrl } from './desktopConfig'
import { executeLocalTool, requestFullAccess } from './localTools'
import type { DesktopLocalToolRequest } from '../../../../src/types/desktop'
import { assertTrustedIpcSender, isSafeExternalUrl } from './rendererSecurity'

const allowedSecretKey = /^[a-zA-Z0-9._-]{1,100}$/

const assertSecretKey = (key: string) => {
  if (!allowedSecretKey.test(key)) throw new Error('非法的安全存储键')
}

const encryptSecret = (value: string) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统没有可用的安全存储，未保存敏感信息')
  }
  return `safe:${safeStorage.encryptString(value).toString('base64')}`
}

export const registerIpcHandlers = async (options: {
  getTrustedContents: () => Electron.WebContents | null
  rendererUrl: string
}) => {
  const store = await createConfigStore(app.getPath('userData'))
  const grantedTopics = new Set<string>()

  const secureHandle = (channel: string, handler: Parameters<typeof ipcMain.handle>[1]) => {
    ipcMain.handle(channel, (event, ...args) => {
      assertTrustedIpcSender(event, options.getTrustedContents(), options.rendererUrl)
      return handler(event, ...args)
    })
  }

  secureHandle('app:get-info', () => ({
    isPackaged: app.isPackaged,
    platform: process.platform,
    version: app.getVersion(),
  }))

  secureHandle('config:get-remote-server', async () => ({
    url: (await store.read()).remoteServerUrl,
  }))

  secureHandle('config:set-remote-server', async (_event, value: unknown) => {
    if (typeof value !== 'string') throw new Error('远程服务地址必须是字符串')
    const config = await store.read()
    const url = normalizeRemoteServerUrl(value)
    await store.write({ ...config, remoteServerUrl: url })
    return { url }
  })

  secureHandle('storage:store-secret', async (_event, key: unknown, value: unknown) => {
    if (typeof key !== 'string' || typeof value !== 'string') throw new Error('安全存储参数无效')
    assertSecretKey(key)
    const config = await store.read()
    config.secrets[key] = encryptSecret(value)
    await store.write(config)
  })

  secureHandle('storage:delete-secret', async (_event, key: unknown) => {
    if (typeof key !== 'string') throw new Error('安全存储键无效')
    assertSecretKey(key)
    const config = await store.read()
    delete config.secrets[key]
    await store.write(config)
  })

  secureHandle('dialog:choose-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths[0]) return null
    const selectedPath = path.resolve(result.filePaths[0])
    const stat = await fs.stat(selectedPath)
    if (!stat.isFile()) return null
    return { name: path.basename(selectedPath), path: selectedPath }
  })

  secureHandle('dialog:choose-directory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled || !result.filePaths[0] ? null : path.resolve(result.filePaths[0])
  })

  secureHandle('permission:request-full', async (_event, topicId: unknown) => {
    if (typeof topicId !== 'string' || topicId.length === 0) throw new Error('话题标识无效')
    return requestFullAccess(topicId, grantedTopics, async () => {
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
    })
  })

  secureHandle('permission:set-scope', async (_event, topicId: unknown, scope: unknown) => {
    if (typeof topicId !== 'string' || !topicId || typeof scope !== 'string' || !path.isAbsolute(scope)) {
      throw new Error('权限范围无效')
    }
    const resolved = path.resolve(scope)
    const stat = await fs.stat(resolved)
    if (!stat.isDirectory()) throw new Error('权限范围必须是目录')
    const config = await store.read()
    const permissionScopes = { ...config.permissionScopes, [topicId]: [resolved] }
    await store.write({ ...config, permissionScopes })
    return { scope: resolved }
  })

  secureHandle('local-system:execute', async (_event, input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('本地工具参数无效')
    const request = input as DesktopLocalToolRequest
    if (
      typeof request.topicId !== 'string' ||
      typeof request.toolCallId !== 'string' ||
      typeof request.toolName !== 'string' ||
      typeof request.mode !== 'string' ||
      !request.args ||
      typeof request.args !== 'object'
    ) {
      throw new Error('本地工具请求缺少必要字段')
    }
    if (request.topicId.length > 200 || request.toolCallId.length > 200) throw new Error('本地工具标识过长')
    if (
      ![
        'editFile',
        'getCommandOutput',
        'killCommand',
        'listFiles',
        'moveFile',
        'readFile',
        'runCommand',
        'searchFiles',
        'writeFile',
      ].includes(request.toolName)
    ) {
      throw new Error('未知本地工具')
    }
    if (!['ask', 'auto', 'full'].includes(request.mode)) throw new Error('无效权限模式')
    return executeLocalTool(request, await store.read(), grantedTopics)
  })

  secureHandle('window:open-external', async (_event, value: unknown) => {
    if (typeof value !== 'string' || !isSafeExternalUrl(value)) throw new Error('不允许打开该外部地址')
    await shell.openExternal(value)
  })

  secureHandle('notification:show', (_event, input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('通知参数无效')
    const { title, body } = input as { title?: unknown; body?: unknown }
    if (typeof title !== 'string' || title.length === 0 || title.length > 200) throw new Error('通知标题无效')
    new Notification({ title, body: typeof body === 'string' ? body.slice(0, 1000) : undefined }).show()
  })

  return {
    getRemoteServerUrl: async () => (await store.read()).remoteServerUrl,
  }
}
