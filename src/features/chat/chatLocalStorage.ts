import type { UIMessage } from 'ai'

export const CHAT_MESSAGES_STORAGE_KEY = 'purechat:chat:v1:messages'

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
