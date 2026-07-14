import type { UIMessage } from 'ai'

import type { LocalChatTopic } from './types'

export type { LocalChatTopic } from './types'

export const CHAT_MESSAGES_STORAGE_KEY = 'purechat:chat:v1:messages'
export const CHAT_TOPICS_STORAGE_KEY = 'purechat:chat:v2:topics'
export const PENDING_CHAT_TEXT_KEY = 'purechat:chat:v1:pending-text'
export const PENDING_TOPIC_SEND_KEY = 'purechat:chat:v2:pending-topic-send'

/** In-memory pending text for home → /chat handoff. */
let pendingChatTextMemory: string | null = null
/** Ensures the pending text is only claimed once per setPendingChatText call. */
let pendingChatTextClaimed = false

/** In-memory pending topic send text. */
let pendingTopicSendMemory: string | null = null
/** Ensures the pending topic send text is only claimed once per setPendingTopicSend. */
let pendingTopicSendClaimed = false

export const messagesStorageKey = (agentId: string, topicId: string | null) =>
  `purechat:chat:v2:messages:${agentId}:${topicId ?? 'draft'}`

const parseMessages = (raw: string | null): UIMessage[] => {
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed as UIMessage[]
  } catch {
    return []
  }
}

const parseTopics = (raw: string | null): LocalChatTopic[] => {
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed as LocalChatTopic[]
  } catch {
    return []
  }
}

export const loadTopics = (): LocalChatTopic[] => {
  if (typeof window === 'undefined') return []

  try {
    return parseTopics(localStorage.getItem(CHAT_TOPICS_STORAGE_KEY))
  } catch {
    return []
  }
}

export const saveTopics = (topics: LocalChatTopic[]): void => {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(CHAT_TOPICS_STORAGE_KEY, JSON.stringify(topics))
  } catch {
    // Ignore quota / private mode errors
  }
}

const migrateLegacyMessages = (agentId: string): UIMessage[] => {
  if (typeof window === 'undefined') return []

  try {
    const legacyRaw = localStorage.getItem(CHAT_MESSAGES_STORAGE_KEY)
    if (!legacyRaw) return []

    const messages = parseMessages(legacyRaw)
    if (messages.length > 0) {
      saveMessages(agentId, null, messages)
    }
    localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY)

    return messages
  } catch {
    return []
  }
}

export const loadMessages = (agentId: string, topicId: string | null): UIMessage[] => {
  if (typeof window === 'undefined') return []

  try {
    const key = messagesStorageKey(agentId, topicId)
    const raw = localStorage.getItem(key)

    if (!raw && topicId === null) {
      return migrateLegacyMessages(agentId)
    }

    return parseMessages(raw)
  } catch {
    return []
  }
}

export const saveMessages = (
  agentId: string,
  topicId: string | null,
  messages: UIMessage[],
): void => {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(messagesStorageKey(agentId, topicId), JSON.stringify(messages))
  } catch {
    // Ignore quota / private mode errors
  }
}

export const clearDraftMessages = (agentId: string): void => {
  saveMessages(agentId, null, [])
}

/** @deprecated Prefer clearDraftMessages(agentId). Clears legacy v1 key only. */
export const clearMessages = (): void => {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY)
  } catch {
    // Ignore
  }
}

export const truncateTitle = (text: string): string => {
  const trimmed = text.trim() || '新话题'
  if (trimmed.length <= 30) return trimmed

  return `${trimmed.slice(0, 29)}…`
}

export const createTopicFromDraft = (input: {
  agentId: string
  titleFrom: string
  topicId?: string
}): LocalChatTopic => {
  const id = input.topicId ?? crypto.randomUUID()
  const draft = loadMessages(input.agentId, null)
  const topic: LocalChatTopic = {
    id,
    agentId: input.agentId,
    title: truncateTitle(input.titleFrom),
    updatedAt: Date.now(),
  }

  saveMessages(input.agentId, id, draft)
  saveMessages(input.agentId, null, [])
  saveTopics([topic, ...loadTopics().filter((t) => t.id !== id)])

  return topic
}

export const touchTopic = (topicId: string): void => {
  const topics = loadTopics()
  const index = topics.findIndex((t) => t.id === topicId)
  if (index === -1) return

  topics[index] = { ...topics[index]!, updatedAt: Date.now() }
  saveTopics(topics)
}

export const listTopicsForAgent = (agentId: string): LocalChatTopic[] =>
  loadTopics()
    .filter((t) => t.agentId === agentId)
    .sort((a, b) => b.updatedAt - a.updatedAt)

export const setPendingChatText = (text: string): void => {
  const next = text.trim()
  pendingChatTextMemory = next || null
  pendingChatTextClaimed = false

  if (typeof window === 'undefined') return

  try {
    if (next) {
      sessionStorage.setItem(PENDING_CHAT_TEXT_KEY, next)
    } else {
      sessionStorage.removeItem(PENDING_CHAT_TEXT_KEY)
    }
  } catch {
    // Ignore quota / private mode errors
  }
}

/** Claim pending home→chat text once. */
export const claimPendingChatText = (): string | null => {
  if (pendingChatTextClaimed) return null

  let text = pendingChatTextMemory

  if (!text && typeof window !== 'undefined') {
    try {
      text = sessionStorage.getItem(PENDING_CHAT_TEXT_KEY)
    } catch {
      text = null
    }
  }

  const next = text?.trim() || null
  if (!next) return null

  pendingChatTextClaimed = true
  pendingChatTextMemory = null

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(PENDING_CHAT_TEXT_KEY)
    } catch {
      // Ignore
    }
  }

  return next
}

export const finishPendingChatText = (_text: string): void => {
  // Reserved for callers that await send completion; claim already consumed the text.
}

export const setPendingTopicSend = (text: string): void => {
  const next = text.trim()
  pendingTopicSendMemory = next || null
  pendingTopicSendClaimed = false

  if (typeof window === 'undefined') return

  try {
    if (next) {
      sessionStorage.setItem(PENDING_TOPIC_SEND_KEY, next)
    } else {
      sessionStorage.removeItem(PENDING_TOPIC_SEND_KEY)
    }
  } catch {
    // Ignore quota / private mode errors
  }
}

/** Claim pending topic send text once per setPendingTopicSend. */
export const claimPendingTopicSend = (): string | null => {
  if (pendingTopicSendClaimed) return null

  let text = pendingTopicSendMemory

  if (!text && typeof window !== 'undefined') {
    try {
      text = sessionStorage.getItem(PENDING_TOPIC_SEND_KEY)
    } catch {
      text = null
    }
  }

  const next = text?.trim() || null
  if (!next) return null

  pendingTopicSendClaimed = true
  pendingTopicSendMemory = null

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(PENDING_TOPIC_SEND_KEY)
    } catch {
      // Ignore
    }
  }

  return next
}

export const finishPendingTopicSend = (): void => {
  pendingTopicSendMemory = null
  pendingTopicSendClaimed = true

  if (typeof window === 'undefined') return

  try {
    sessionStorage.removeItem(PENDING_TOPIC_SEND_KEY)
  } catch {
    // Ignore
  }
}
