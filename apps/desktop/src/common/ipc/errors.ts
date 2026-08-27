export type IpcErrorEnvelope = {
  __pureChatIpcError: true
  code?: string
  message: string
  name: string
  stack?: string
}

export const isIpcErrorEnvelope = (value: unknown): value is IpcErrorEnvelope =>
  Boolean(
    value &&
    typeof value === 'object' &&
    '__pureChatIpcError' in value &&
    (value as { __pureChatIpcError?: unknown }).__pureChatIpcError === true
  )

export const toIpcErrorEnvelope = (error: unknown): IpcErrorEnvelope => {
  const value = error instanceof Error ? error : new Error(String(error))
  return {
    __pureChatIpcError: true,
    message: value.message,
    name: value.name,
    ...(value.stack ? { stack: value.stack } : {}),
  }
}

export const fromIpcErrorEnvelope = (envelope: IpcErrorEnvelope): Error => {
  const error = new Error(envelope.message)
  error.name = envelope.name
  if (envelope.stack) error.stack = envelope.stack
  return error
}
