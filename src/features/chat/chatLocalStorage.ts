import { sessionStg } from '@pure/utils/storage'
import { CHAT_PERMISSION_MODES, DEFAULT_CHAT_PERMISSION_MODE } from '@pure/types'
import type { ChatPermissionMode } from '@pure/types'

export const PENDING_CHAT_TEXT_KEY = 'purechat:chat:v1:pending-text'
export const PENDING_CHAT_PERMISSION_MODE_KEY = 'purechat:chat:v1:pending-permission-mode'
export const PENDING_CHAT_PROJECT_KEY = 'purechat:chat:v1:pending-project'
export const PENDING_TOPIC_SEND_KEY = 'purechat:chat:v2:pending-topic-send'

export type PendingChatProject = {
  name: string
  rootPath: string
}

/** In-memory pending text for home → /chat handoff. */
let pendingChatTextMemory: string | null = null
/** Ensures the pending text is only claimed once per setPendingChatText call. */
let pendingChatTextClaimed = false
/** File objects only survive the in-app home → chat navigation. */
let pendingChatFilesMemory: File[] = []

/** In-memory pending topic send text. */
let pendingTopicSendMemory: string | null = null
/** Ensures the pending topic send text is only claimed once per setPendingTopicSend. */
let pendingTopicSendClaimed = false
let pendingTopicSendFiles: File[] = []

export const truncateTitle = (text: string): string => {
  const trimmed = text.trim() || '新话题'
  if (trimmed.length <= 30) return trimmed

  return `${trimmed.slice(0, 29)}…`
}

export const setPendingChatText = (text: string): void => {
  const next = text.trim()
  pendingChatTextMemory = next || null
  pendingChatTextClaimed = false

  if (next) {
    sessionStg.setString(PENDING_CHAT_TEXT_KEY, next)
  } else {
    sessionStg.remove(PENDING_CHAT_TEXT_KEY)
  }
}

export const setPendingChatFiles = (files: File[]): void => {
  pendingChatFilesMemory = files
}

export const setPendingChatPermissionMode = (mode: ChatPermissionMode): void => {
  sessionStg.setString(PENDING_CHAT_PERMISSION_MODE_KEY, mode)
}

export const getPendingChatPermissionMode = (): ChatPermissionMode => {
  const mode = sessionStg.getString(PENDING_CHAT_PERMISSION_MODE_KEY)
  return CHAT_PERMISSION_MODES.includes(mode as ChatPermissionMode)
    ? (mode as ChatPermissionMode)
    : DEFAULT_CHAT_PERMISSION_MODE
}

export const setPendingChatProject = (project: PendingChatProject | null): void => {
  if (!project?.name.trim() || !project.rootPath.trim()) {
    sessionStg.remove(PENDING_CHAT_PROJECT_KEY)
    return
  }
  sessionStg.setString(
    PENDING_CHAT_PROJECT_KEY,
    JSON.stringify({ name: project.name.trim(), rootPath: project.rootPath.trim() } satisfies PendingChatProject)
  )
}

export const claimPendingChatProject = (): PendingChatProject | null => {
  const raw = sessionStg.getString(PENDING_CHAT_PROJECT_KEY)
  sessionStg.remove(PENDING_CHAT_PROJECT_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PendingChatProject>
    const name = typeof parsed.name === 'string' ? parsed.name.trim() : ''
    const rootPath = typeof parsed.rootPath === 'string' ? parsed.rootPath.trim() : ''
    if (!name || !rootPath) return null
    return { name, rootPath }
  } catch {
    return null
  }
}

export const claimPendingChatFiles = (): File[] => {
  const files = pendingChatFilesMemory
  pendingChatFilesMemory = []
  return files
}

/** Claim pending home→chat text once. */
export const claimPendingChatText = (): string | null => {
  if (pendingChatTextClaimed) return null

  let text = pendingChatTextMemory

  if (!text) text = sessionStg.getString(PENDING_CHAT_TEXT_KEY)

  const next = text?.trim() || null
  if (!next) return null

  pendingChatTextClaimed = true
  pendingChatTextMemory = null

  sessionStg.remove(PENDING_CHAT_TEXT_KEY)

  return next
}

export const finishPendingChatText = (_text: string): void => {
  pendingChatFilesMemory = []
  sessionStg.remove(PENDING_CHAT_PERMISSION_MODE_KEY)
  sessionStg.remove(PENDING_CHAT_PROJECT_KEY)
}

export const setPendingTopicSend = (text: string): void => {
  const next = text.trim()
  pendingTopicSendMemory = next || null
  pendingTopicSendClaimed = false

  if (next) {
    sessionStg.setString(PENDING_TOPIC_SEND_KEY, next)
  } else {
    sessionStg.remove(PENDING_TOPIC_SEND_KEY)
  }
}

export const setPendingTopicSendFiles = (files: File[]): void => {
  pendingTopicSendFiles = files
}

export const claimPendingTopicSendFiles = (): File[] => {
  const files = pendingTopicSendFiles
  pendingTopicSendFiles = []
  return files
}

/** Claim pending topic send text once per setPendingTopicSend. */
export const claimPendingTopicSend = (): string | null => {
  if (pendingTopicSendClaimed) return null

  let text = pendingTopicSendMemory

  if (!text) text = sessionStg.getString(PENDING_TOPIC_SEND_KEY)

  const next = text?.trim() || null
  if (!next) return null

  pendingTopicSendClaimed = true
  pendingTopicSendMemory = null

  sessionStg.remove(PENDING_TOPIC_SEND_KEY)

  return next
}

export const finishPendingTopicSend = (): void => {
  pendingTopicSendMemory = null
  pendingTopicSendClaimed = true
  pendingTopicSendFiles = []

  sessionStg.remove(PENDING_TOPIC_SEND_KEY)
}
