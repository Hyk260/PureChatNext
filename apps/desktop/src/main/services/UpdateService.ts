import { app, Notification } from 'electron'
import { autoUpdater } from 'electron-updater'

export class UpdateService {
  private started = false
  private readonly onDownloaded = () => {
    new Notification({
      title: 'PureChat 更新已就绪',
      body: '退出并重新打开应用即可完成更新。',
    }).show()
  }

  start() {
    if (this.started || !app.isPackaged) return
    this.started = true
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('update-downloaded', this.onDownloaded)
    void autoUpdater.checkForUpdates().catch((error) => {
      // Update metadata is optional for development and self-hosted builds.
      console.warn('PureChat update check skipped', error instanceof Error ? error.message : error)
    })
  }

  dispose() {
    if (!this.started) return
    autoUpdater.off('update-downloaded', this.onDownloaded)
    this.started = false
  }
}
