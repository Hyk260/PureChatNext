import type { UIMessage } from 'ai'

import { isLocalToolName } from '@/features/chat/localTools'

export type ApprovalToolPart = {
  approval?: { id: string }
  input?: Record<string, unknown>
  state: string
  toolCallId: string
  type: string
}

export type ToolApprovalItem =
  | {
      args: Record<string, unknown>
      kind: 'local'
      toolCallId: string
      toolName: string
    }
  | {
      approvalId?: string
      args: Record<string, unknown>
      kind: 'server'
      toolCallId: string
      toolName: string
    }

type MessagePart = UIMessage['parts'][number]

const isToolPartWithState = (part: MessagePart, state: string): part is MessagePart & ApprovalToolPart => {
  if (typeof part.type !== 'string' || !part.type.startsWith('tool-')) return false
  return (part as { state?: string }).state === state
}

export const getToolNameFromPartType = (type: string) => (type.startsWith('tool-') ? type.slice(5) : type)

/** Desktop local tools waiting for in-UI approval (`input-available`). */
export const getLocalApprovalParts = (parts: UIMessage['parts']): ApprovalToolPart[] =>
  parts.filter((part): part is MessagePart & ApprovalToolPart => {
    if (!isToolPartWithState(part, 'input-available')) return false
    return isLocalToolName(getToolNameFromPartType(part.type))
  })

/** Server tools waiting for explicit approval (`approval-requested`). */
export const getServerApprovalParts = (parts: UIMessage['parts']): ApprovalToolPart[] =>
  parts.filter((part): part is MessagePart & ApprovalToolPart => isToolPartWithState(part, 'approval-requested'))

/** Unified approval cards for a message: local desktop tools + server approval-gated tools. */
export const getToolApprovalItems = (parts: UIMessage['parts']): ToolApprovalItem[] => [
  ...getLocalApprovalParts(parts).map((part) => ({
    args: part.input ?? {},
    kind: 'local' as const,
    toolCallId: part.toolCallId,
    toolName: getToolNameFromPartType(part.type),
  })),
  ...getServerApprovalParts(parts).map((part) => ({
    approvalId: part.approval?.id,
    args: part.input ?? {},
    kind: 'server' as const,
    toolCallId: part.toolCallId,
    toolName: getToolNameFromPartType(part.type),
  })),
]
