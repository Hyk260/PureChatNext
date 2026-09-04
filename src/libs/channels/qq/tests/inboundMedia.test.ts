import { describe, expect, it } from 'vitest'

import { prepareQQFileForAgent } from '../inboundMedia'

describe('prepareQQFileForAgent', () => {
  it('parses a text file and returns truncated metadata', async () => {
    const result = await prepareQQFileForAgent({
      buffer: Buffer.from('hello from qq'),
      fileName: '../note.txt',
      mimeType: 'text/plain',
    })

    expect(result.fileName).toBe('note.txt')
    expect(result.fileType).toBe('txt')
    expect(result.mimeType).toBe('text/plain')
    expect(result.content).toBe('hello from qq')
    expect(result.truncated).toBe(false)
  })

  it('rejects files larger than the inbound limit', async () => {
    await expect(
      prepareQQFileForAgent({
        buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
        fileName: 'large.txt',
      })
    ).rejects.toThrow('文件超过 10MB 限制')
  })
})
