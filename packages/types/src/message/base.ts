import { type ErrorType } from "../fetch"

export interface ChatMessageError {
  body?: unknown
  message?: string
  type: ErrorType | string | number
}

export interface ModelReasoning {
  content?: string
  duration?: number
  isMultimodal?: boolean
  signature?: string
}
