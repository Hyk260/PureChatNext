import type { DesktopLocalCommandCancellation, DesktopLocalToolRequest } from '@/types/desktop'

import type { IpcRegistry } from '../ipc/IpcRegistry'
import type { LocalToolService } from '../services/LocalToolService'

const LOCAL_TOOL_NAMES = new Set([
  'editFile',
  'getCommandOutput',
  'getSystemInfo',
  'killCommand',
  'listFiles',
  'moveFile',
  'readFile',
  'runCommand',
  'searchFiles',
  'writeFile',
])

export class LocalSystemController {
  constructor(private readonly tools: LocalToolService) {}

  register(ipc: IpcRegistry) {
    ipc.register('localSystem.execute', (request) => {
      this.assertRequest(request)
      return this.tools.execute(request)
    })
    ipc.register('localSystem.cancel', (request) => {
      this.assertCancellation(request)
      this.tools.cancelCommand(request.topicId, request.toolCallId)
    })
  }

  private assertRequest(request: DesktopLocalToolRequest) {
    if (!request.topicId || request.topicId.length > 200 || !request.toolCallId || request.toolCallId.length > 200) {
      throw new Error('本地工具标识无效')
    }
    if (!LOCAL_TOOL_NAMES.has(request.toolName)) throw new Error('未知本地工具')
    if (!['ask', 'auto', 'full'].includes(request.mode)) throw new Error('无效权限模式')
  }

  private assertCancellation(request: DesktopLocalCommandCancellation) {
    if (!request.topicId || request.topicId.length > 200 || !request.toolCallId || request.toolCallId.length > 200) {
      throw new Error('本地命令标识无效')
    }
  }
}
