import type { ChatPermissionMode } from '@pure/types'

export type DesktopApprovalPrompt = {
  detail: string
  message: string
  title: string
}

export type DesktopApprovalHandler = (prompt: DesktopApprovalPrompt) => Promise<boolean>

export class PermissionService {
  private readonly grantedTopics = new Set<string>()
  private readonly approvals = new Map<string, Promise<boolean>>()

  constructor(private readonly confirm: DesktopApprovalHandler = async () => false) {}

  async requestFullAccess(topicId: string) {
    if (this.grantedTopics.has(topicId)) return { granted: true }

    const granted = await this.confirmOnce(JSON.stringify([topicId, 'full']), {
      detail: `会话标识：${JSON.stringify(topicId)}\n此授权仅适用于当前会话，并会在会话期间保留。`,
      message: '允许 PureChat 在当前会话中访问所选工作目录之外的文件，并直接执行命令？',
      title: '确认完全访问权限',
    })
    if (!granted) return { granted: false }

    this.grantedTopics.add(topicId)
    return { granted: true }
  }

  hasFullAccess(topicId: string) {
    return this.grantedTopics.has(topicId)
  }

  assertExecutionAllowed(topicId: string, mode: ChatPermissionMode) {
    if (mode === 'full' && !this.hasFullAccess(topicId)) throw new Error('完全访问权限尚未确认')
  }

  private confirmOnce(key: string, prompt: DesktopApprovalPrompt): Promise<boolean> {
    const existing = this.approvals.get(key)
    if (existing) return existing

    const confirmation = Promise.resolve()
      .then(() => this.confirm(prompt))
      .then(
        (granted) => {
          if (this.approvals.get(key) !== confirmation) return false
          if (!granted) this.approvals.delete(key)
          return granted
        },
        (error: unknown) => {
          if (this.approvals.get(key) === confirmation) this.approvals.delete(key)
          throw error
        }
      )
    this.approvals.set(key, confirmation)
    return confirmation
  }

  dispose() {
    this.grantedTopics.clear()
    this.approvals.clear()
  }
}
