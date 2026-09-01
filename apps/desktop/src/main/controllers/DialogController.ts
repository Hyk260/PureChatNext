import { promises as fs } from 'node:fs'
import path from 'node:path'

import { BrowserWindow, dialog } from 'electron'

import type { IpcRegistry } from '../ipc/IpcRegistry'

function parentWindow() {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? undefined
}

async function showOpenDialog(options: {
  buttonLabel: string
  properties: Array<'openDirectory' | 'openFile'>
  title: string
}) {
  const parent = parentWindow()
  const dialogOptions = {
    buttonLabel: options.buttonLabel,
    properties: options.properties,
    title: options.title,
  }
  return parent ? dialog.showOpenDialog(parent, dialogOptions) : dialog.showOpenDialog(dialogOptions)
}

export class DialogController {
  register(ipc: IpcRegistry) {
    ipc.register('dialog.chooseFile', async () => {
      const result = await showOpenDialog({
        buttonLabel: '打开',
        properties: ['openFile'],
        title: '选择文件',
      })
      if (result.canceled || !result.filePaths[0]) return null
      const selectedPath = path.resolve(result.filePaths[0])
      if (!(await fs.stat(selectedPath)).isFile()) return null
      return { name: path.basename(selectedPath), path: selectedPath }
    })
    ipc.register('dialog.chooseDirectory', async () => {
      const result = await showOpenDialog({
        buttonLabel: '选择',
        properties: ['openDirectory'],
        title: '选择工作目录',
      })
      return result.canceled || !result.filePaths[0] ? null : path.resolve(result.filePaths[0])
    })
  }
}
