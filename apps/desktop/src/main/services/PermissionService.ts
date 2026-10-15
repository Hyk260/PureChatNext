import type { ChatPermissionMode } from '@pure/types'

export class PermissionService {
  private readonly grantedTopics = new Set<string>()
  private readonly showFullAccessConfirmation: () => Promise<boolean>

  constructor(showFullAccessConfirmation: () => Promise<boolean>) {
    this.showFullAccessConfirmation = showFullAccessConfirmation
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

  dispose() {
    this.grantedTopics.clear()
  }
}
