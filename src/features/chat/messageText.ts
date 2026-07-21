import { type UIMessage } from 'ai'

export const getMessageText = (message: UIMessage): string =>
  message.parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .filter(Boolean)
    .join('')

export const getMessageReasoning = (message: UIMessage): string =>
  message.parts
    .map((part) => (part.type === 'reasoning' ? part.text : ''))
    .filter(Boolean)
    .join('')

export const withMessageText = (message: UIMessage, text: string): UIMessage => ({
  ...message,
  parts: [{ type: 'text', text }],
})
