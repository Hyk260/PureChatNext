import type { WebContents } from 'electron'

import type { IpcRegistry } from '../ipc/IpcRegistry'
import type { BrowserService } from '../services/BrowserService'

export class BrowserController {
  private readonly owners = new Map<WebContents, () => void>()

  constructor(
    private readonly service: BrowserService,
    private readonly getContents: () => WebContents | null
  ) {}

  private owner() {
    const owner = this.getContents()
    if (!owner || owner.isDestroyed()) throw new Error('浏览器窗口不可用')
    if (!this.owners.has(owner)) {
      const reset = () => {
        this.service.reset(owner).catch(() => undefined)
      }
      this.owners.set(owner, reset)
      owner.on('render-process-gone', reset)
      owner.on('did-start-navigation', this.onNavigation)
      owner.once('destroyed', reset)
    }
    return owner
  }

  private readonly onNavigation = (_event: unknown, _url: string, inPlace: boolean, mainFrame: boolean) => {
    if (mainFrame && !inPlace) this.service.reset().catch(() => undefined)
  }

  register(ipc: IpcRegistry) {
    ipc.register('browser.open', (input) => this.service.open(this.owner(), input?.contextKey))
    ipc.register('browser.navigate', (input) => this.service.navigate(this.owner(), input?.sessionId, input?.url))
    ipc.register('browser.back', (input) => this.service.action(this.owner(), input?.sessionId, 'back'))
    ipc.register('browser.forward', (input) => this.service.action(this.owner(), input?.sessionId, 'forward'))
    ipc.register('browser.reload', (input) => this.service.action(this.owner(), input?.sessionId, 'reload'))
    ipc.register('browser.stop', (input) => this.service.action(this.owner(), input?.sessionId, 'stop'))
    ipc.register('browser.layout', (input) => this.service.layout(this.owner(), input))
    ipc.register('browser.capture', (input) => this.service.capture(this.owner(), input?.sessionId))
    ipc.register('browser.openExternal', (input) => this.service.openExternal(this.owner(), input?.sessionId))
    ipc.register('browser.pick', (input) => this.service.pick(this.owner(), input?.sessionId))
    ipc.register('browser.cancelPick', (input) => this.service.cancelPick(this.owner(), input?.sessionId))
    ipc.register('browser.close', (input) => this.service.close(this.owner(), input?.sessionId))
    ipc.register('browser.reset', () => this.service.reset(this.owner()))
  }

  dispose() {
    for (const [owner, reset] of this.owners) {
      owner.removeListener('render-process-gone', reset)
      owner.removeListener('destroyed', reset)
      owner.removeListener('did-start-navigation', this.onNavigation)
    }
    this.owners.clear()
    this.service.reset().catch(() => undefined)
  }
}
