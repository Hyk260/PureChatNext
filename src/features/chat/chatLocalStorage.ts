import type { UIMessage } from 'ai'

export const CHAT_MESSAGES_STORAGE_KEY = 'purechat:chat:v1:messages'
export const PENDING_CHAT_TEXT_KEY = 'purechat:chat:v1:pending-text'

/** In-memory pending text for home → /chat handoff. */
let pendingChatTextMemory: string | null = null
/** Ensures the pending text is only claimed once per setPendingChatText call. */
let pendingChatTextClaimed = false

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

export const loadMessages = (): UIMessage[] => {
  if (typeof window === 'undefined') return []

  try {
    const raw = localStorage.getItem(CHAT_MESSAGES_STORAGE_KEY)
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed as UIMessage[]
  } catch {
    return []
  }
}

export const saveMessages = (messages: UIMessage[]): void => {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(CHAT_MESSAGES_STORAGE_KEY, JSON.stringify(messages))
  } catch {
    // Ignore quota / private mode errors
  }
}

export const clearMessages = (): void => {
  saveMessages([])
}
