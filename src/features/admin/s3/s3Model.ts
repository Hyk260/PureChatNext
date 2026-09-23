export type ActionMode = 'upload' | 'list' | 'download' | 'delete' | 'rename'

export type ResultView = 'results' | 'json'

export type CopyState = 'idle' | 'copied' | 'failed'

export type FileInfo = {
  Key: string
  LastModified: string
  Size: number
}

export type RunState = {
  durationMs: number
  status: number
  submittedAt: string
}

export type S3FormValues = {
  contentType: string
  deleteKey: string
  downloadKey: string
  expiresIn: string
  listPrefix: string
  renameNewKey: string
  renameOldKey: string
  textContent: string
  textKey: string
  uploadKey: string
}

export type UploadResultData = {
  contentType?: string
  key: string
  size: number
}

export type DownloadResultData = {
  downloadUrl: string
  expiresIn: number
  key: string
}

export type DeleteResultData = { deleted: true; key: string } | { deleted: true; keys: string[] }

export type RenameResultData = {
  newKey: string
  oldKey: string
  renamed: true
}

export type S3Result =
  | { data: DeleteResultData; kind: 'delete' }
  | { data: DownloadResultData; kind: 'download' }
  | { data: FileInfo[]; kind: 'list' }
  | { data: RenameResultData; kind: 'rename' }
  | { data: UploadResultData; kind: 'upload' }

export type S3JsonRequest = {
  body?: unknown
  method: 'DELETE' | 'GET' | 'POST' | 'PUT'
  search: Record<string, string>
}

export type S3SubmitPlan = { file: File; key: string; kind: 'file' } | { kind: 'json'; request: S3JsonRequest }

export const S3_API_PATH = '/api/admin/s3'
export const DEFAULT_EXPIRES_IN = '7200'
export const DEFAULT_LIST_PREFIX = 'dev/'

export const COPY_LABEL: Record<CopyState, string> = {
  idle: '复制',
  copied: '已复制',
  failed: '复制失败',
}

export const ACTION_ORDER: ActionMode[] = ['upload', 'list', 'download', 'delete', 'rename']

export const ACTION_META: Record<ActionMode, { description: string; label: string }> = {
  delete: {
    description: '删除单个文件。操作不可恢复。',
    label: '删除',
  },
  download: {
    description: '生成预签名下载链接。',
    label: '下载',
  },
  list: {
    description: '按前缀列出文件。留空则列出 dev/ 下的全部对象。',
    label: '列表',
  },
  rename: {
    description: '复制到新路径后再删除原对象。',
    label: '重命名',
  },
  upload: {
    description: '上传本地文件，或直接写入一段文本。对象会保存到 dev/ 前缀下。',
    label: '上传',
  },
}

const IMAGE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'])

export const initialForm = (): S3FormValues => ({
  contentType: '',
  deleteKey: '',
  downloadKey: '',
  expiresIn: DEFAULT_EXPIRES_IN,
  listPrefix: '',
  renameNewKey: '',
  renameOldKey: '',
  textContent: '',
  textKey: '',
  uploadKey: '',
})

export const isImageKey = (key: string): boolean => {
  const ext = key.split('.').pop()?.toLowerCase()
  return ext ? IMAGE_EXTENSIONS.has(ext) : false
}

export const listQueryPrefix = (prefix: string) => prefix || DEFAULT_LIST_PREFIX

export const withSearch = (path: string, search: Record<string, string>) => {
  const query = new URLSearchParams(search).toString()
  return query ? `${path}?${query}` : path
}

export function canSubmit(action: ActionMode, values: S3FormValues, fileCount: number): boolean {
  if (action === 'upload') return fileCount > 0 || (values.textKey.trim().length > 0 && values.textContent.length > 0)
  if (action === 'download') return values.downloadKey.trim().length > 0
  if (action === 'delete') return values.deleteKey.trim().length > 0
  if (action === 'rename') return values.renameOldKey.trim().length > 0 && values.renameNewKey.trim().length > 0
  return true
}

export function buildRequestPreview(action: ActionMode, values: S3FormValues, fileNames: string[]) {
  if (action === 'upload' && fileNames.length > 0) {
    return {
      action: 'uploadFile',
      files: fileNames,
      key: values.uploadKey || fileNames[0] || '',
    }
  }

  if (action === 'upload') {
    return {
      action: 'uploadText',
      content: values.textContent.substring(0, 100),
      key: values.textKey,
    }
  }

  if (action === 'list') return { action: 'list', prefix: values.listPrefix || undefined }
  if (action === 'download') {
    return {
      action: 'downloadUrl',
      expiresIn: Number.parseInt(values.expiresIn, 10),
      key: values.downloadKey,
    }
  }
  if (action === 'delete') return { action: 'deleteOne', key: values.deleteKey }
  return { action: 'rename', newKey: values.renameNewKey, oldKey: values.renameOldKey }
}

export function planSubmit(action: ActionMode, values: S3FormValues, files: File[]): S3SubmitPlan {
  if (action === 'upload' && files[0]) {
    return { file: files[0], key: values.uploadKey, kind: 'file' }
  }

  return { kind: 'json', request: jsonRequest(action, values) }
}

export function formAfterSuccess(action: ActionMode, values: S3FormValues): S3FormValues {
  if (action === 'upload') {
    return { ...values, contentType: '', textContent: '', textKey: '', uploadKey: '' }
  }
  if (action === 'delete') return { ...values, deleteKey: '' }
  if (action === 'rename') return { ...values, renameNewKey: '', renameOldKey: '' }
  return values
}

export function isApiSuccess(value: unknown): value is { data: unknown; success: true } {
  return isRecord(value) && value.success === true
}

export function readApiError(value: unknown, status: number): string {
  if (isRecord(value) && typeof value.error === 'string' && value.error) return value.error
  return status ? `Request failed with ${status}` : 'Request failed'
}

export function readFileList(data: unknown): FileInfo[] | null {
  if (!Array.isArray(data)) return null

  const files: FileInfo[] = []
  for (const item of data) {
    const file = readFileInfo(item)
    if (file) files.push(file)
  }
  return files
}

export function readResult(action: ActionMode, data: unknown): S3Result | null {
  if (action === 'upload') {
    const parsed = readUpload(data)
    return parsed ? { data: parsed, kind: 'upload' } : null
  }
  if (action === 'list') {
    const parsed = readFileList(data)
    return parsed ? { data: parsed, kind: 'list' } : null
  }
  if (action === 'download') {
    const parsed = readDownload(data)
    return parsed ? { data: parsed, kind: 'download' } : null
  }
  if (action === 'delete') {
    const parsed = readDelete(data)
    return parsed ? { data: parsed, kind: 'delete' } : null
  }

  const parsed = readRename(data)
  return parsed ? { data: parsed, kind: 'rename' } : null
}

function jsonRequest(action: ActionMode, values: S3FormValues): S3JsonRequest {
  if (action === 'upload') {
    const body: Record<string, string> = { content: values.textContent, key: values.textKey }
    if (values.contentType) body.contentType = values.contentType
    return {
      body,
      method: 'POST',
      search: { action: values.textContent ? 'uploadText' : 'uploadBuffer' },
    }
  }

  if (action === 'list') {
    const search: Record<string, string> = { action: 'list' }
    if (values.listPrefix) search.prefix = values.listPrefix
    return { method: 'GET', search }
  }

  if (action === 'download') {
    return {
      method: 'GET',
      search: { action: 'downloadUrl', expiresIn: values.expiresIn, key: values.downloadKey },
    }
  }

  if (action === 'delete') {
    return { method: 'DELETE', search: { action: 'deleteOne', key: values.deleteKey } }
  }

  return {
    body: { newKey: values.renameNewKey, oldKey: values.renameOldKey },
    method: 'PUT',
    search: { action: 'rename' },
  }
}

function readUpload(data: unknown): UploadResultData | null {
  if (!isRecord(data) || typeof data.key !== 'string' || typeof data.size !== 'number') return null
  return {
    contentType: typeof data.contentType === 'string' ? data.contentType : undefined,
    key: data.key,
    size: data.size,
  }
}

function readDownload(data: unknown): DownloadResultData | null {
  if (!isRecord(data) || typeof data.key !== 'string' || typeof data.downloadUrl !== 'string') return null
  return {
    downloadUrl: data.downloadUrl,
    expiresIn: typeof data.expiresIn === 'number' ? data.expiresIn : 0,
    key: data.key,
  }
}

function readDelete(data: unknown): DeleteResultData | null {
  if (!isRecord(data) || data.deleted !== true) return null
  const keys = readStringList(data.keys)
  if (keys) return { deleted: true, keys }
  if (typeof data.key === 'string') return { deleted: true, key: data.key }
  return null
}

function readRename(data: unknown): RenameResultData | null {
  if (!isRecord(data) || data.renamed !== true) return null
  if (typeof data.oldKey !== 'string' || typeof data.newKey !== 'string') return null
  return { newKey: data.newKey, oldKey: data.oldKey, renamed: true }
}

function readFileInfo(value: unknown): FileInfo | null {
  if (!isRecord(value) || typeof value.Key !== 'string') return null
  return {
    Key: value.Key,
    LastModified: typeof value.LastModified === 'string' ? value.LastModified : '',
    Size: typeof value.Size === 'number' ? value.Size : 0,
  }
}

function readStringList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  if (!value.every((item) => typeof item === 'string')) return null
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
