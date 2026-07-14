export type LocalChatTopic = {
  id: string
  agentId: string
  title: string
  updatedAt: number
}

export type ChatLlmParams = {
  temperature: number | null
  top_p: number | null
  presence_penalty: number | null
  frequency_penalty: number | null
}

export const DEFAULT_CHAT_LLM_PARAMS: ChatLlmParams = {
  temperature: 1,
  top_p: 1,
  presence_penalty: 0,
  frequency_penalty: 0,
}
