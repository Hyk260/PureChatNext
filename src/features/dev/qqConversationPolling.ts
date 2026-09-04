import type { QQDevMessage } from './qqConversationApi'

export const MESSAGE_POLL_DELAYS = [2_000, 5_000, 10_000, 15_000] as const

const ACTIVE_STATUSES = new Set(['pending', 'processing', 'retry'])

function compareMessages(a: QQDevMessage, b: QQDevMessage): number {
  const timeDifference = a.createdAt.localeCompare(b.createdAt)
  if (timeDifference) return timeDifference
  if (a.eventId !== b.eventId) return a.eventId < b.eventId ? -1 : 1
  if (a.role !== b.role) return a.role === 'user' ? -1 : 1
  return a.id === b.id ? 0 : a.id < b.id ? -1 : 1
}

export function mergeQQDevMessages(
  current: QQDevMessage[],
  incoming: QQDevMessage[]
): { changed: boolean; messages: QQDevMessage[] } {
  const byId = new Map(current.map((message) => [message.id, message]))
  let changed = false
  for (const message of incoming) {
    const previous = byId.get(message.id)
    if (!previous || JSON.stringify(previous) !== JSON.stringify(message)) changed = true
    byId.set(message.id, message)
  }
  const messages = [...byId.values()].sort(compareMessages)
  if (messages.length !== current.length) changed = true
  if (!changed && messages.some((message, index) => message.id !== current[index]?.id)) changed = true
  return { changed, messages }
}

export function hasActiveQQMessages(messages: QQDevMessage[]): boolean {
  return messages.some((message) => message.status && ACTIVE_STATUSES.has(message.status))
}

export function getActiveQQEventIds(messages: QQDevMessage[]): string[] {
  return [
    ...new Set(
      messages
        .filter((message) => message.status && ACTIVE_STATUSES.has(message.status))
        .map((message) => message.eventId)
    ),
  ]
}

export function nextQQMessagePollDelay(
  currentDelay: number,
  options: { changed: boolean; pending: boolean }
): number {
  if (options.changed || options.pending) return MESSAGE_POLL_DELAYS[0]
  const index = MESSAGE_POLL_DELAYS.findIndex((delay) => delay >= currentDelay)
  return MESSAGE_POLL_DELAYS[Math.min((index < 0 ? 0 : index) + 1, MESSAGE_POLL_DELAYS.length - 1)]
}
