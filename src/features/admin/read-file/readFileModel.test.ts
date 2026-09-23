import { describe, expect, it } from 'vitest'

import type { DocumentPage, FileDocument } from '@pure/file-loaders'

import {
  canSubmit,
  contentTypeLabel,
  createSampleFile,
  pageTitle,
  readApiError,
  resultSummaryItems,
  summarizeValue,
} from './readFileModel'

const page = (metadata: DocumentPage['metadata'] = {}): DocumentPage => ({
  charCount: 10,
  lineCount: 2,
  metadata,
  pageContent: 'hello',
})

describe('canSubmit', () => {
  it('requires a file in file mode', () => {
    expect(canSubmit('file', null, 'https://x.com/a.pdf')).toBe(false)
    expect(canSubmit('file', new File(['x'], 'a.txt'), '')).toBe(true)
  })

  it('requires a non-empty url in url mode', () => {
    expect(canSubmit('url', null, '  ')).toBe(false)
    expect(canSubmit('url', null, 'https://x.com/a.pdf')).toBe(true)
  })
})

describe('contentTypeLabel', () => {
  it('maps mode to request content type', () => {
    expect(contentTypeLabel('file')).toBe('multipart/form-data')
    expect(contentTypeLabel('url')).toBe('application/json')
  })
})

describe('summarizeValue', () => {
  it('formats empty and numeric values', () => {
    expect(summarizeValue(undefined)).toBe('N/A')
    expect(summarizeValue(null)).toBe('N/A')
    expect(summarizeValue('')).toBe('N/A')
    expect(summarizeValue(1200)).toBe((1200).toLocaleString())
    expect(summarizeValue('report.pdf')).toBe('report.pdf')
  })
})

describe('pageTitle', () => {
  it('falls back to index and prefers metadata labels', () => {
    expect(pageTitle(page(), 2)).toBe('Page 3')
    expect(pageTitle(page({ pageNumber: 7 }), 0)).toBe('Page 7')
    expect(pageTitle(page({ sheetName: 'Sheet1' }), 0)).toBe('Page Sheet1')
  })
})

describe('createSampleFile', () => {
  it('builds a markdown sample file', () => {
    const sample = createSampleFile()
    expect(sample.name).toBe('read-file-sample.md')
    expect(sample.type).toBe('text/markdown')
  })
})

describe('readApiError', () => {
  it('prefers payload.error then status fallback', () => {
    expect(readApiError({ error: 'boom' }, 500)).toBe('boom')
    expect(readApiError({}, 418)).toBe('Request failed with 418')
  })
})

describe('resultSummaryItems', () => {
  it('builds four summary rows', () => {
    const result = {
      filename: 'a.pdf',
      fileType: 'pdf',
      totalCharCount: 12,
      totalLineCount: 3,
    } as FileDocument

    expect(resultSummaryItems(result)).toEqual([
      { label: '文件名', value: 'a.pdf' },
      { label: '文件类型', value: 'pdf' },
      { label: '字符数', value: (12).toLocaleString() },
      { label: '行数', value: (3).toLocaleString() },
    ])
  })
})
