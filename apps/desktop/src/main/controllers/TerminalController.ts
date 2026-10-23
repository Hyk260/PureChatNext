import type { WebContents } from 'electron'

import type { IpcRegistry } from '../ipc/IpcRegistry'
import type { TerminalService } from '../services/TerminalService'

export class TerminalController {
  private readonly owners = new Map<WebContents, () => void>()

  constructor(
    private readonly service: TerminalService,
    private readonly getContents: () => WebContents | null
  ) {}

  private owner() {
    const contents = this.getContents()
    if (!contents || contents.isDestroyed()) throw new Error('终端窗口不可用')
    if (!this.owners.has(contents)) {
      const onDestroyed = () => {
        this.reset()
        this.release(contents)
      }
      this.owners.set(contents, onDestroyed)
      contents.on('did-start-navigation', this.onNavigation)
      contents.on('render-process-gone', this.reset)
      contents.once('destroyed', onDestroyed)
    }
    return contents.id
  }

  private readonly reset = () => this.service.reset()
  private readonly onNavigation = (_event: unknown, _url: string, isInPlace: boolean, isMainFrame: boolean) => {
    if (isMainFrame && !isInPlace) this.reset()
  }

  register(ipc: IpcRegistry) {
    ipc.register('terminal.open', (input) => this.service.open(this.owner(), input))
    ipc.register('terminal.write', (input) => this.service.write(this.owner(), input))
    ipc.register('terminal.resize', (input) => this.service.resize(this.owner(), input))
    ipc.register('terminal.kill', (input) => {
      if (!input) throw new Error('终端标识无效')
      this.service.kill(this.owner(), input.sessionId)
    })
  }

  dispose() {
    this.reset()
    for (const contents of this.owners.keys()) this.release(contents)
  }

  private release(contents: WebContents) {
    const destroyed = this.owners.get(contents)
    if (destroyed) contents.removeListener('destroyed', destroyed)
    contents.removeListener('did-start-navigation', this.onNavigation)
    contents.removeListener('render-process-gone', this.reset)
    this.owners.delete(contents)
  }
}
