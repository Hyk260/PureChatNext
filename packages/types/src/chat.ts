export const CHAT_PERMISSION_MODES = ['ask', 'auto', 'full'] as const

export type ChatPermissionMode = (typeof CHAT_PERMISSION_MODES)[number]

export const DEFAULT_CHAT_PERMISSION_MODE: ChatPermissionMode = 'auto'
