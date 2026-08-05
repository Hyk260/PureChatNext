import { describe, expect, it } from 'vitest'

import {
  encodeWechatFileContent,
  encodeWechatImageContent,
  parseWechatFileContent,
  parseWechatImageContent,
} from '../inboundMedia'

describe('inboundMedia', () => {
  it('round-trips image metadata for CDN download', () => {
    const encoded = encodeWechatImageContent({
      aeskey: 'a'.repeat(32),
      media: { encrypt_query_param: 'query', encrypt_type: 1 },
      thumb_media: { encrypt_query_param: 'thumb' },
      url: 'https://example.com/a.jpg',
    })
    expect(parseWechatImageContent(encoded)).toEqual({
      aeskey: 'a'.repeat(32),
      media: { encrypt_query_param: 'query', encrypt_type: 1 },
      thumb_media: { encrypt_query_param: 'thumb' },
      type: 'image',
      url: 'https://example.com/a.jpg',
      v: 1,
    })
  })

  it('round-trips file metadata for CDN download', () => {
    const encoded = encodeWechatFileContent({
      file_name: 'notes.docx',
      len: '4096',
      md5: 'abc',
      media: { encrypt_query_param: 'file-param', encrypt_type: 1 },
    })
    expect(parseWechatFileContent(encoded)).toEqual({
      file_name: 'notes.docx',
      len: '4096',
      md5: 'abc',
      media: { encrypt_query_param: 'file-param', encrypt_type: 1 },
      type: 'file',
      v: 1,
    })
  })

  it('rejects plain text and unsupported placeholders', () => {
    expect(parseWechatImageContent('hello')).toBeNull()
    expect(parseWechatImageContent('[unsupported message]')).toBeNull()
    expect(parseWechatImageContent('{"type":"image"}')).toBeNull()
    expect(parseWechatFileContent('hello')).toBeNull()
    expect(parseWechatFileContent('{"type":"file"}')).toBeNull()
    expect(parseWechatFileContent(encodeWechatImageContent({ url: 'https://x' }))).toBeNull()
  })
})
