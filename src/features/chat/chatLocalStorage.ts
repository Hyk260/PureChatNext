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

export const truncateTitle = (text: string): string => {
  const trimmed = text.trim() || '新话题'
  if (trimmed.length <= 30) return trimmed

  return `${trimmed.slice(0, 29)}…`
}

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
