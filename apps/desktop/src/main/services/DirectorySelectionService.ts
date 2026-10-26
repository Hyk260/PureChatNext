import path from 'node:path'

const SELECTION_TTL_MS = 5 * 60 * 1000
const MAX_SELECTIONS = 32

export class DirectorySelectionService {
  private readonly selections = new Map<string, number>()

  record(directoryPath: string) {
    const now = Date.now()
    this.prune(now)
    const resolved = path.resolve(directoryPath)
    this.selections.delete(resolved)
    if (this.selections.size >= MAX_SELECTIONS) {
      const oldest = this.selections.keys().next().value
      if (oldest) this.selections.delete(oldest)
    }
    this.selections.set(resolved, now)
  }

  consume(directoryPath: string) {
    const resolved = path.resolve(directoryPath)
    const selectedAt = this.selections.get(resolved)
    this.selections.delete(resolved)
    return selectedAt !== undefined && Date.now() - selectedAt <= SELECTION_TTL_MS
  }

  clear() {
    this.selections.clear()
  }

  private prune(now: number) {
    for (const [directoryPath, selectedAt] of this.selections) {
      if (now - selectedAt > SELECTION_TTL_MS) this.selections.delete(directoryPath)
    }
  }
}
