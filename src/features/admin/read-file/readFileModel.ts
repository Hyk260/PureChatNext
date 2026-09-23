import type { DocumentPage, FileDocument } from '@pure/file-loaders'

export type RequestMode = 'file' | 'url'
export type ResultView = 'content' | 'pages' | 'json'
export type CopyState = 'idle' | 'copied' | 'failed'

export type ApiError = {
  error?: string
}

export type RunState = {
  durationMs: number
  mode: RequestMode
  status: number
  submittedAt: string
}

export type SummaryItem = {
  label: string
  value: string
}

export const READ_FILE_API_PATH = '/api/admin/read-file'
export const READ_FILE_ENDPOINT_LABEL = 'POST /api/admin/read-file'

export const SUPPORTED_FORMATS = ['TXT', 'MD', 'CSV', 'JSON', 'PDF', 'DOCX', 'XLSX', 'XLS', 'PPTX'] as const

export const COPY_LABEL: Record<CopyState, string> = {
  idle: '复制 JSON',
  copied: '已复制',
  failed: '复制失败',
}

export const MODE_META: Record<RequestMode, { description: string; label: string }> = {
  file: {
    description: 'multipart 上传本地文件并解析',
    label: '上传文件',
  },
  url: {
    description: '服务端下载远程 URL 并按扩展名解析',
    label: 'URL',
  },
}

export const RESULT_VIEW_LABEL: Record<ResultView, string> = {
  content: '内容',
  json: 'JSON',
  pages: '分页',
}

export const EXAMPLE_MARKDOWN = `# PureChat read-file smoke test

This sample checks the multipart upload path.

- Plain text extraction
- Line and character counts
- Page/chunk rendering
`

export const canSubmit = (mode: RequestMode, file: File | null, url: string): boolean =>
  mode === 'file' ? Boolean(file) : url.trim().length > 0

export const contentTypeLabel = (mode: RequestMode): string =>
  mode === 'file' ? 'multipart/form-data' : 'application/json'

export const summarizeValue = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return 'N/A'
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}

export const pageTitle = (page: DocumentPage, index: number): string => {
  const metadata = page.metadata ?? {}
  const label =
    metadata.pageNumber ?? metadata.slideNumber ?? metadata.sheetName ?? metadata.sectionTitle ?? metadata.chunkIndex

  return label === undefined ? `Page ${index + 1}` : `Page ${label}`
}

export const createSampleFile = (): File =>
  new File([EXAMPLE_MARKDOWN], 'read-file-sample.md', { type: 'text/markdown' })

export const readApiError = (payload: unknown, status: number): string => {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const message = (payload as ApiError).error
    if (message) return message
  }
  return `Request failed with ${status}`
}

export const resultSummaryItems = (result: FileDocument | null): SummaryItem[] => [
  { label: '文件名', value: summarizeValue(result?.filename) },
  { label: '文件类型', value: summarizeValue(result?.fileType) },
  { label: '字符数', value: summarizeValue(result?.totalCharCount) },
  { label: '行数', value: summarizeValue(result?.totalLineCount) },
]

export const downloadResultJson = (rawJson: string, filename: string) => {
  const blob = new Blob([rawJson], { type: 'application/json' })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = `${filename || 'read-file-result'}.json`
  anchor.click()
  URL.revokeObjectURL(href)
}

export const metaRows = (mode: RequestMode, runState: RunState | null): Array<[string, string]> => [
  ['Endpoint', READ_FILE_ENDPOINT_LABEL],
  ['Content-Type', contentTypeLabel(mode)],
  ['状态码', runState ? String(runState.status) : 'N/A'],
  ['耗时', runState ? `${runState.durationMs.toLocaleString()} ms` : 'N/A'],
  ['提交时间', runState?.submittedAt ?? 'N/A'],
]
