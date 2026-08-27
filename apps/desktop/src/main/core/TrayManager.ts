import { Menu, nativeImage, Tray } from 'electron'

export class TrayManager {
  private tray: Tray | null = null

  constructor(
    private readonly trayImagePath: string,
    private readonly focusWindow: () => void,
    private readonly quit: () => void
  ) {}

  create() {
    if (this.tray) return
    this.tray = new Tray(nativeImage.createFromPath(this.trayImagePath).resize({ height: 16 }))
    this.tray.setToolTip('PureChat')
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { click: this.focusWindow, label: '打开 PureChat' },
        { click: this.quit, label: '退出 PureChat' },
      ])
    )
    this.tray.on('click', this.focusWindow)
  }

  destroy() {
    this.tray?.destroy()
    this.tray = null
  }

  get exists() {
    return this.tray !== null
  }
}
