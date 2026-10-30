export interface ServiceModelReference {
  provider: string
  model: string
  contextWindowTokens?: number
}

export interface ServiceSpeechModelReference extends ServiceModelReference {
  voice?: string
  /** Native Bailian speech endpoint; never contains an API key. */
  endpoint?: string
}

export interface QQSpeechModelReference extends ServiceSpeechModelReference {
  replyMode?: 'smart' | 'always' | 'never'
  instruction?: string
}

/** Per-user models for auxiliary chat services. Secrets stay in provider settings. */
export interface ServiceModelSettings {
  topicNaming?: ServiceModelReference
  historyCompression?: ServiceModelReference
  qqSpeech?: ServiceSpeechModelReference
}

export type ServiceModelSettingsKey = keyof ServiceModelSettings

export type ServiceModelSettingsPatch = {
  [K in ServiceModelSettingsKey]?: ServiceModelSettings[K] | null
}
