export type ChannelPollMessage = {
  createdAt: string
  eventId: string
  id: string
  role: 'assistant' | 'user'
  status?: string
}

export const MESSAGE_POLL_DELAYS = [2_000, 5_000, 10_000, 15_000] as const

const ACTIVE_STATUSES = new Set(['pending', 'processing', 'retry'])

function compareMessages(a: ChannelPollMessage, b: ChannelPollMessage): number {
  const timeDifference = a.createdAt.localeCompare(b.createdAt)
  if (timeDifference) return timeDifference
  if (a.eventId !== b.eventId) return a.eventId < b.eventId ? -1 : 1
  if (a.role !== b.role) return a.role === 'user' ? -1 : 1
  return a.id === b.id ? 0 : a.id < b.id ? -1 : 1
}

export function mergeChannelMessages<T extends ChannelPollMessage>(
  current: T[],
  incoming: T[]
): { changed: boolean; messages: T[] } {
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

function isActiveChannelMessage(message: ChannelPollMessage): boolean {
  return Boolean(message.status && ACTIVE_STATUSES.has(message.status))
}

export function hasActiveChannelMessages(messages: ChannelPollMessage[]): boolean {
  return messages.some(isActiveChannelMessage)
}

export function getActiveChannelEventIds(messages: ChannelPollMessage[]): string[] {
  return [
    ...new Set(messages.filter(isActiveChannelMessage).map((message) => message.eventId)),
  ]
}

export function nextChannelMessagePollDelay(
  currentDelay: number,
  options: { changed: boolean; pending: boolean }
): number {
  if (options.changed || options.pending) return MESSAGE_POLL_DELAYS[0]
  const index = MESSAGE_POLL_DELAYS.findIndex((delay) => delay >= currentDelay)
  return MESSAGE_POLL_DELAYS[Math.min((index < 0 ? 0 : index) + 1, MESSAGE_POLL_DELAYS.length - 1)]
}
