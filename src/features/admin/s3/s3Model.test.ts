import { describe, expect, it } from 'vitest'

import {
  buildRequestPreview,
  canSubmit,
  formAfterSuccess,
  initialForm,
  isImageKey,
  listQueryPrefix,
  planSubmit,
  readApiError,
  readResult,
} from './s3Model'
import type { S3FormValues } from './s3Model'

const form = (patch: Partial<S3FormValues> = {}): S3FormValues => ({ ...initialForm(), ...patch })

const file = (name: string) => new File(['hello'], name, { type: 'text/plain' })

describe('canSubmit', () => {
  it('requires a file or both text key and content for upload', () => {
    expect(canSubmit('upload', form(), 0)).toBe(false)
    expect(canSubmit('upload', form({ textKey: 'a.txt' }), 0)).toBe(false)
    expect(canSubmit('upload', form({ textContent: 'hi', textKey: 'a.txt' }), 0)).toBe(true)
    expect(canSubmit('upload', form(), 1)).toBe(true)
  })

  it('requires both rename keys and allows an empty list prefix', () => {
    expect(canSubmit('rename', form({ renameOldKey: 'a' }), 0)).toBe(false)
    expect(canSubmit('rename', form({ renameNewKey: 'b', renameOldKey: 'a' }), 0)).toBe(true)
    expect(canSubmit('list', form(), 0)).toBe(true)
  })
})

describe('buildRequestPreview', () => {
  it('previews the first file upload and truncates text content', () => {
    expect(buildRequestPreview('upload', form({ uploadKey: 'note.txt' }), ['note.txt', 'b.txt'])).toEqual({
      action: 'uploadFile',
      files: ['note.txt', 'b.txt'],
      key: 'note.txt',
    })
    expect(buildRequestPreview('upload', form({ textContent: 'x'.repeat(120), textKey: 'a.txt' }), [])).toEqual({
      action: 'uploadText',
      content: 'x'.repeat(100),
      key: 'a.txt',
    })
  })

  it('omits an empty list prefix', () => {
    expect(buildRequestPreview('list', form(), [])).toEqual({ action: 'list', prefix: undefined })
  })
})

describe('planSubmit', () => {
  it('uploads the first selected file', () => {
    const selected = file('photo.png')
    expect(planSubmit('upload', form({ uploadKey: 'photo.png' }), [selected])).toEqual({
      file: selected,
      key: 'photo.png',
      kind: 'file',
    })
  })

  it('sends text, buffer, delete, and rename with the matching method', () => {
    expect(planSubmit('upload', form({ contentType: 'text/plain', textContent: 'hi', textKey: 'a.txt' }), [])).toEqual({
      kind: 'json',
      request: {
        body: { content: 'hi', contentType: 'text/plain', key: 'a.txt' },
        method: 'POST',
        search: { action: 'uploadText' },
      },
    })
    expect(planSubmit('upload', form({ textKey: 'a.txt' }), [])).toEqual({
      kind: 'json',
      request: {
        body: { content: '', key: 'a.txt' },
        method: 'POST',
        search: { action: 'uploadBuffer' },
      },
    })
    expect(planSubmit('delete', form({ deleteKey: 'a.txt' }), [])).toEqual({
      kind: 'json',
      request: { method: 'DELETE', search: { action: 'deleteOne', key: 'a.txt' } },
    })
    expect(planSubmit('rename', form({ renameNewKey: 'b.txt', renameOldKey: 'a.txt' }), [])).toEqual({
      kind: 'json',
      request: {
        body: { newKey: 'b.txt', oldKey: 'a.txt' },
        method: 'PUT',
        search: { action: 'rename' },
      },
    })
  })
})

describe('readResult', () => {
  it('reads upload, list, and both delete shapes', () => {
    expect(readResult('upload', { contentType: 'text/plain', key: 'dev/a.txt', size: 2 })).toEqual({
      data: { contentType: 'text/plain', key: 'dev/a.txt', size: 2 },
      kind: 'upload',
    })
    expect(readResult('list', [{ Key: 'dev/a.txt', LastModified: '2026-01-01', Size: 2 }])).toEqual({
      data: [{ Key: 'dev/a.txt', LastModified: '2026-01-01', Size: 2 }],
      kind: 'list',
    })
    expect(readResult('delete', { deleted: true, keys: ['dev/a.txt'] })).toEqual({
      data: { deleted: true, keys: ['dev/a.txt'] },
      kind: 'delete',
    })
    expect(readResult('upload', { key: 'missing-size' })).toBeNull()
  })

  it('reads an error string and ignores a non-object body', () => {
    expect(readApiError({ error: 'Missing "key"', success: false }, 400)).toBe('Missing "key"')
    expect(readApiError(null, 500)).toBe('Request failed with 500')
  })
})

describe('form helpers', () => {
  it('clears only the fields the successful action wrote', () => {
    const values = form({ deleteKey: 'a', textContent: 'hi', textKey: 'a.txt', uploadKey: 'a.txt' })
    expect(formAfterSuccess('upload', values).uploadKey).toBe('')
    expect(formAfterSuccess('upload', values).deleteKey).toBe('a')
    expect(formAfterSuccess('list', values)).toEqual(values)
  })

  it('detects image keys and the default list prefix', () => {
    expect(isImageKey('dev/a.PNG')).toBe(true)
    expect(isImageKey('dev/a.txt')).toBe(false)
    expect(listQueryPrefix('')).toBe('dev/')
    expect(listQueryPrefix('shots/')).toBe('shots/')
  })
})
