import { Menu } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'

const separator: MenuItemConstructorOptions = { type: 'separator' }

export const getApplicationMenuTemplate = (): MenuItemConstructorOptions[] => {
  const isMac = process.platform === 'darwin'

  return [
    ...(isMac ? [{
      label: 'PureChat',
      submenu: [
        { label: '关于 PureChat', role: 'about' as const },
        separator,
        { label: '服务', role: 'services' as const, submenu: [] },
        separator,
        { label: '隐藏 PureChat', role: 'hide' as const },
        { label: '隐藏其他', role: 'hideOthers' as const },
        { label: '显示全部', role: 'unhide' as const },
        separator,
        { label: '退出 PureChat', role: 'quit' as const },
      ],
    }] : []),
    {
      label: '文件',
      submenu: [
        { label: '关闭窗口', role: 'close' as const },
        ...(!isMac ? [{ label: '退出 PureChat', role: 'quit' as const }] : []),
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' as const },
        { label: '重做', role: 'redo' as const },
        separator,
        { label: '剪切', role: 'cut' as const },
        { label: '复制', role: 'copy' as const },
        { label: '粘贴', role: 'paste' as const },
        { label: '全选', role: 'selectAll' as const },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' as const },
        { label: '强制重新加载', role: 'forceReload' as const },
        { label: '切换开发者工具', role: 'toggleDevTools' as const },
        separator,
        { label: '实际大小', role: 'resetZoom' as const },
        { label: '放大', role: 'zoomIn' as const },
        { label: '缩小', role: 'zoomOut' as const },
        separator,
        { label: '切换全屏', role: 'togglefullscreen' as const },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' as const },
        { label: '缩放', role: 'zoom' as const },
        ...(isMac ? [separator, { label: '置于最前', role: 'front' as const }] : []),
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: 'PureChat 帮助', role: 'help' as const },
      ],
    },
  ]
}

export const createApplicationMenu = () => Menu.buildFromTemplate(getApplicationMenuTemplate())

export const installApplicationMenu = () => {
  Menu.setApplicationMenu(createApplicationMenu())
}
