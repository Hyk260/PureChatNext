import { promises as fs } from 'node:fs'
import path from 'node:path'

import { BrowserWindow, dialog } from 'electron'

import type { IpcRegistry } from '../ipc/IpcRegistry'

function parentWindow() {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? undefined
}

async function showOpenDialog(properties: Array<'openDirectory' | 'openFile'>) {
  const parent = parentWindow()
  return parent ? dialog.showOpenDialog(parent, { properties }) : dialog.showOpenDialog({ properties })
}

export class DialogController {
  register(ipc: IpcRegistry) {
    ipc.register('dialog.chooseFile', async () => {
      const result = await showOpenDialog(['openFile'])
      if (result.canceled || !result.filePaths[0]) return null
      const selectedPath = path.resolve(result.filePaths[0])
      if (!(await fs.stat(selectedPath)).isFile()) return null
      return { name: path.basename(selectedPath), path: selectedPath }
    })
    ipc.register('dialog.chooseDirectory', async () => {
      const result = await showOpenDialog(['openDirectory'])
      return result.canceled || !result.filePaths[0] ? null : path.resolve(result.filePaths[0])
    })
  }
}
