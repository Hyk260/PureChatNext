import { ipcMain } from 'electron'

import type {
  DesktopIpcArgs,
  DesktopIpcChannel,
  DesktopIpcContractMap,
  DesktopIpcResult,
} from '../../common/ipc/contracts'
import { toIpcErrorEnvelope } from '../../common/ipc/errors'
import { assertTrustedIpcSender } from '../security/IpcSenderPolicy'

type IpcHandler<C extends DesktopIpcChannel> = (
  ...args: DesktopIpcArgs<C>
) => DesktopIpcResult<C> | Promise<DesktopIpcResult<C>>

export class IpcRegistry {
  private readonly registeredChannels = new Set<DesktopIpcChannel>()

  constructor(
    private readonly getTrustedContents: () => Electron.WebContents | null,
    private readonly rendererUrl: string
  ) {}

  register<C extends DesktopIpcChannel>(channel: C, handler: IpcHandler<C>) {
    if (this.registeredChannels.has(channel)) throw new Error(`IPC 通道重复注册: ${channel}`)
    this.registeredChannels.add(channel)
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        assertTrustedIpcSender(event, this.getTrustedContents(), this.rendererUrl)
        return await handler(...(args as DesktopIpcArgs<C>))
      } catch (error) {
        return toIpcErrorEnvelope(error)
      }
    })
  }

  unregisterAll() {
    for (const channel of this.registeredChannels) ipcMain.removeHandler(channel)
    this.registeredChannels.clear()
  }
}

export type DesktopIpcHandlers = {
  [C in DesktopIpcChannel]: (...args: DesktopIpcArgs<C>) => DesktopIpcResult<C> | Promise<DesktopIpcResult<C>>
}

export type DesktopIpcContract = DesktopIpcContractMap
