import { promises as fs } from 'node:fs'
import path from 'node:path'

import { dialog } from 'electron'

import type { IpcRegistry } from '../ipc/IpcRegistry'

export class DialogController {
  register(ipc: IpcRegistry) {
    ipc.register('dialog.chooseFile', async () => {
      const result = await dialog.showOpenDialog({ properties: ['openFile'] })
      if (result.canceled || !result.filePaths[0]) return null
      const selectedPath = path.resolve(result.filePaths[0])
      if (!(await fs.stat(selectedPath)).isFile()) return null
      return { name: path.basename(selectedPath), path: selectedPath }
    })
    ipc.register('dialog.chooseDirectory', async () => {
      const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
      return result.canceled || !result.filePaths[0] ? null : path.resolve(result.filePaths[0])
    })
  }
}
