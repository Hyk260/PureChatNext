import { ipcRenderer } from 'electron'

import type { DesktopIpcArgs, DesktopIpcChannel, DesktopIpcResult } from '../common/ipc/contracts'
import { fromIpcErrorEnvelope, isIpcErrorEnvelope } from '../common/ipc/errors'

export const invoke = async <C extends DesktopIpcChannel>(
  channel: C,
  ...args: DesktopIpcArgs<C>
): Promise<DesktopIpcResult<C>> => {
  const result: unknown = await ipcRenderer.invoke(channel, ...args)
  if (isIpcErrorEnvelope(result)) throw fromIpcErrorEnvelope(result)
  return result as DesktopIpcResult<C>
}
