import type { ChatPermissionMode } from '@pure/types'

export class PermissionService {
  private readonly grantedTopics = new Set<string>()

  async requestFullAccess(topicId: string) {
    if (this.grantedTopics.has(topicId)) return { granted: true }
    if (topicId !== 'draft' && this.grantedTopics.has('draft')) {
      this.grantedTopics.add(topicId)
      return { granted: true }
    }
    this.grantedTopics.add(topicId)
    return { granted: true }
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
