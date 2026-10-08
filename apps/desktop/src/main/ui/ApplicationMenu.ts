import { Menu, shell } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'

import { createLogger, getLogDirectory } from '@main/logger'
import { FileStorage } from '../services/FileStorage'

const separator: MenuItemConstructorOptions = { type: 'separator' }
const quitMenuItem: MenuItemConstructorOptions = { label: '退出 PureChat', role: 'quit' }

export const installApplicationMenu = (rootDir?: string) => {
  const logger = createLogger('ApplicationMenu', rootDir)
  const fileStorage = new FileStorage(rootDir)
  const isMac = process.platform === 'darwin'
  const appMenu: MenuItemConstructorOptions | undefined = isMac
    ? {
        label: 'PureChat',
        submenu: [
          { label: '关于 PureChat', role: 'about' },
          separator,
          { label: '服务', role: 'services', submenu: [] },
          separator,
          { label: '隐藏 PureChat', role: 'hide' },
          { label: '隐藏其他', role: 'hideOthers' },
          { label: '显示全部', role: 'unhide' },
          separator,
          { label: '退出 PureChat', role: 'quit' },
        ],
      }
    : undefined
  const fileMenu: MenuItemConstructorOptions = {
    label: '文件',
    submenu: [{ label: '关闭窗口', role: 'close' }, ...(!isMac ? [quitMenuItem] : [])],
  }
  const editMenu: MenuItemConstructorOptions = {
    label: '编辑',
    submenu: [
      { label: '撤销', role: 'undo' },
      { label: '重做', role: 'redo' },
      separator,
      { label: '剪切', role: 'cut' },
      { label: '复制', role: 'copy' },
      { label: '粘贴', role: 'paste' },
      { label: '全选', role: 'selectAll' },
    ],
  }
  const viewMenu: MenuItemConstructorOptions = {
    label: '视图',
    submenu: [
      { label: '重新加载', role: 'reload' },
      { label: '强制重新加载', role: 'forceReload' },
      { label: '切换开发者工具', role: 'toggleDevTools' },
      separator,
      { label: '实际大小', role: 'resetZoom' },
      { label: '放大', role: 'zoomIn' },
      { label: '缩小', role: 'zoomOut' },
      separator,
      { label: '切换全屏', role: 'togglefullscreen' },
    ],
  }
  const windowMenu: MenuItemConstructorOptions = {
    label: '窗口',
    submenu: [
      { label: '最小化', role: 'minimize' },
      { label: '缩放', role: 'zoom' },
      ...(isMac ? [separator, { label: '置于最前', role: 'front' as const }] : []),
    ],
  }
  const helpMenu: MenuItemConstructorOptions = {
    label: '帮助',
    submenu: [
      {
        label: '文档',
        click: () =>
          shell
            .openExternal('https://next-docs.purechat.cn')
            .catch((error) => logger.error('打开文档失败', error)),
      },
      {
        label: '网站',
        click: () =>
          shell
            .openExternal('https://next.purechat.cn')
            .catch((error) => logger.error('打开网站失败', error)),
      },
      {
        label: '反馈',
        click: () =>
          shell
            .openExternal('https://github.com/Hyk260/PureChatNext/discussions')
            .catch((error) => logger.error('打开反馈页面失败', error)),
      },
      {
        label: '版本发布',
        click: () =>
          shell
            .openExternal('https://github.com/Hyk260/PureChatNext/releases')
            .catch((error) => logger.error('打开版本发布页面失败', error)),
      },
      {
        label: '打开日志目录',
        click: () => fileStorage.openPath(getLogDirectory(rootDir)),
      },
      { label: 'PureChat 帮助', role: 'help' },
    ],
  }
  const template: MenuItemConstructorOptions[] = [
    ...(appMenu ? [appMenu] : []),
    fileMenu,
    editMenu,
    viewMenu,
    windowMenu,
    helpMenu,
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  logger.info('应用菜单已安装', { platform: process.platform })
}
