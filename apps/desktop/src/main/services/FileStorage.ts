import { shell } from 'electron'

import { createLogger } from '@main/logger'

export class FileStorage {
  private readonly logger

  constructor(rootDir?: string) {
    this.logger = createLogger('FileStorage', rootDir)
  }

  async openPath(targetPath: string): Promise<void> {
    try {
      const errorMessage = await shell.openPath(targetPath)
      if (errorMessage) throw new Error(errorMessage)
      this.logger.info('Opened path:', targetPath)
    } catch (error) {
      this.logger.error('Failed to open file/path:', error)
    }
  }
}
