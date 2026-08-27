import type { ChatPermissionMode } from '@pure/types'

export class PermissionService {
  private readonly grantedTopics = new Set<string>()
  private readonly toolApprovals = new Map<string, boolean>()
  private readonly showFullAccessConfirmation: () => Promise<boolean>
  private readonly showToolApprovalConfirmation: (description: string) => Promise<boolean>

  constructor(
    showFullAccessConfirmation: () => Promise<boolean>,
    showToolApprovalConfirmation?: (description: string) => Promise<boolean>
  ) {
    this.showFullAccessConfirmation = showFullAccessConfirmation
    this.showToolApprovalConfirmation = showToolApprovalConfirmation ?? (async () => showFullAccessConfirmation())
  }

  async requestFullAccess(topicId: string) {
    if (this.grantedTopics.has(topicId)) return { granted: true }
    if (topicId !== 'draft' && this.grantedTopics.has('draft')) {
      this.grantedTopics.add(topicId)
      return { granted: true }
    }
    const granted = await this.showFullAccessConfirmation()
    if (granted) this.grantedTopics.add(topicId)
    return { granted }
  }

  hasFullAccess(topicId: string) {
    return this.grantedTopics.has(topicId)
  }

  assertExecutionAllowed(topicId: string, mode: ChatPermissionMode) {
    if (mode === 'full' && !this.hasFullAccess(topicId)) throw new Error('完全访问权限尚未确认')
  }

  async requestToolApproval(topicId: string, toolCallId: string, description: string) {
    const key = `${topicId}:${toolCallId}`
    const previous = this.toolApprovals.get(key)
    if (previous !== undefined) return previous
    const approved = await this.showToolApprovalConfirmation(description)
    this.toolApprovals.set(key, approved)
    return approved
  }

  dispose() {
    this.grantedTopics.clear()
    this.toolApprovals.clear()
  }
}
