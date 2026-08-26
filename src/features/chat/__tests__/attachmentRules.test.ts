import { describe, expect, it } from 'vitest'

import { MAX_CHAT_ATTACHMENT_BYTES, validateChatAttachments } from '../attachmentRules'

describe('validateChatAttachments', () => {
  it('limits the combined attachment count to eight', () => {
    const files = [new File(['a'], 'a.txt')]
    expect(validateChatAttachments(files, 8)).toBe('最多支持 8 个附件')
  })

  it('rejects a file larger than 10MB', () => {
    const file = new File([new Uint8Array(MAX_CHAT_ATTACHMENT_BYTES + 1)], 'large.pdf')
    expect(validateChatAttachments([file])).toBe('附件「large.pdf」超过 10MB 限制')
  })
})
