export const CHAT_PERMISSION_MODES = ['ask', 'auto', 'full'] as const

export type ChatPermissionMode = (typeof CHAT_PERMISSION_MODES)[number]

export const DEFAULT_CHAT_PERMISSION_MODE: ChatPermissionMode = 'auto'

export interface ChatAdvancedSettings {
  enableContextCompression: boolean
  enableHistoryCount: boolean
  historyCount: number
  inputTemplate: string
}

export const DEFAULT_CHAT_ADVANCED_SETTINGS: ChatAdvancedSettings = {
  enableContextCompression: true,
  enableHistoryCount: false,
  historyCount: 20,
  inputTemplate: '',
}
