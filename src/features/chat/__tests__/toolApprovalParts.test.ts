import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import {
  getLocalApprovalParts,
  getServerApprovalParts,
  getToolApprovalItems,
  getToolNameFromPartType,
} from '../toolApprovalParts'

describe('getToolNameFromPartType', () => {
  it('strips the tool- prefix', () => {
    expect(getToolNameFromPartType('tool-readFile')).toBe('readFile')
    expect(getToolNameFromPartType('readFile')).toBe('readFile')
  })
})

describe('getLocalApprovalParts', () => {
  it('keeps only local tools in input-available state', () => {
    const parts = [
      { state: 'input-available', toolCallId: '1', type: 'tool-readFile' },
      { state: 'input-available', toolCallId: '2', type: 'tool-webSearch' },
      { state: 'approval-requested', toolCallId: '3', type: 'tool-writeFile' },
      { state: 'output-available', toolCallId: '4', type: 'tool-listFiles' },
    ] as unknown as UIMessage['parts']

    expect(getLocalApprovalParts(parts).map((part) => part.toolCallId)).toEqual(['1'])
  })
})

describe('getServerApprovalParts', () => {
  it('keeps tool parts waiting for server approval', () => {
    const parts = [
      { approval: { id: 'a1' }, state: 'approval-requested', toolCallId: '1', type: 'tool-weather' },
      { state: 'input-available', toolCallId: '2', type: 'tool-readFile' },
    ] as unknown as UIMessage['parts']

    expect(getServerApprovalParts(parts).map((part) => part.toolCallId)).toEqual(['1'])
  })
})

describe('getToolApprovalItems', () => {
  it('merges local and server approvals into one list with kind', () => {
    const parts = [
      { input: { path: '/tmp/a' }, state: 'input-available', toolCallId: 'local-1', type: 'tool-readFile' },
      {
        approval: { id: 'a1' },
        input: { city: 'Shanghai' },
        state: 'approval-requested',
        toolCallId: 'server-1',
        type: 'tool-weather',
      },
    ] as unknown as UIMessage['parts']

    expect(getToolApprovalItems(parts)).toEqual([
      {
        args: { path: '/tmp/a' },
        kind: 'local',
        toolCallId: 'local-1',
        toolName: 'readFile',
      },
      {
        approvalId: 'a1',
        args: { city: 'Shanghai' },
        kind: 'server',
        toolCallId: 'server-1',
        toolName: 'weather',
      },
    ])
  })
})
