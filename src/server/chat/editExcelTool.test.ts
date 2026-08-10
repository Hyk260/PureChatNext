// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  editExcelBuffer: vi.fn(),
  listWechatConversationFiles: vi.fn(),
  persistWechatFile: vi.fn(),
  readWechatFile: vi.fn(),
}))

vi.mock('@pure/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@pure/utils')>()),
  editExcelBuffer: mocks.editExcelBuffer,
}))
vi.mock('@/libs/channels/wechat/fileArtifacts', () => ({
  listWechatConversationFiles: mocks.listWechatConversationFiles,
  persistWechatFile: mocks.persistWechatFile,
  readWechatFile: mocks.readWechatFile,
}))

import { createEditExcelTool } from './editExcelTool'

describe('createEditExcelTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listWechatConversationFiles.mockResolvedValue([
      {
        artifact: { direction: 'input', version: 1 },
        file: { id: 'file-input', name: 'source.xlsx' },
      },
      {
        artifact: { direction: 'output', version: 2 },
        file: { id: 'file-output', name: 'source-v2.xlsx' },
      },
    ])
    mocks.readWechatFile.mockResolvedValue({ buffer: Buffer.from('xlsx'), file: { id: 'file-output', name: 'source-v2.xlsx' } })
    mocks.editExcelBuffer.mockReturnValue({
      buffer: Buffer.from('edited'),
      changes: [{ cell: 'A1', from: '徐澳星', sheet: '记录', to: '厉飞雨' }],
      sheetNames: ['记录'],
    })
    mocks.persistWechatFile.mockResolvedValue({
      artifactId: 'artifact-output',
      file: { id: 'file-v3', name: 'source-v3.xlsx', size: 100 },
    })
  })

  it('uses the latest generated version and publishes the produced artifact', async () => {
    const producedArtifacts: Array<Record<string, unknown>> = []
    const excelTool = createEditExcelTool({
      conversationVersion: 1,
      event: { conversationVersion: 1, id: 'event-1', sessionId: 'session-1' },
      producedArtifacts: producedArtifacts as never[],
      sessionId: 'session-1',
      userId: 'user-1',
    })

    const result = await excelTool.execute!(
      { operations: [{ find: '徐澳星', mode: 'substring', replace: '厉飞雨', type: 'replace' }] },
      { abortSignal: new AbortController().signal, messages: [], toolCallId: 'call-1' } as never
    )

    expect(mocks.readWechatFile).toHaveBeenCalledWith('user-1', 'file-output')
    expect(mocks.persistWechatFile).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'output', filename: 'source-v3.xlsx', sourceFileId: 'file-output', version: 3 })
    )
    expect(result).toMatchObject({ fileId: 'file-v3', success: true, version: 3 })
    expect(producedArtifacts).toEqual([expect.objectContaining({ artifactId: 'artifact-output', fileId: 'file-v3' })])
  })

  it('returns an actionable error when no workbook is available', async () => {
    mocks.listWechatConversationFiles.mockResolvedValue([])
    const excelTool = createEditExcelTool({
      conversationVersion: 1,
      event: { conversationVersion: 1, id: 'event-1', sessionId: 'session-1' },
      producedArtifacts: [],
      sessionId: 'session-1',
      userId: 'user-1',
    })

    await expect(
      excelTool.execute!(
        { operations: [{ find: 'A', mode: 'substring', replace: 'B', type: 'replace' }] },
        { abortSignal: new AbortController().signal, messages: [], toolCallId: 'call-1' } as never
      )
    ).resolves.toEqual(expect.objectContaining({ success: false }))
  })
})
