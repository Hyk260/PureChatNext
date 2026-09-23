'use client'

import { useEffect, useState } from 'react'
import { Segmented } from 'antd'
import { Download, HardDrive, Pencil, Trash2, Upload } from 'lucide-react'

import { useApp } from '@/components/AntdStaticMethods'
import { apiFetch, jsonInit } from '@/utils/apiFetch'

import { S3Form } from './S3Form'
import { S3Results } from './S3Results'
import {
  ACTION_META,
  ACTION_ORDER,
  buildRequestPreview,
  canSubmit,
  formAfterSuccess,
  initialForm,
  isApiSuccess,
  listQueryPrefix,
  planSubmit,
  readApiError,
  readFileList,
  readResult,
  S3_API_PATH,
  withSearch,
} from './s3Model'
import type { ActionMode, CopyState, FileInfo, ResultView, RunState, S3FormValues } from './s3Model'

const ACTION_ICONS = {
  delete: Trash2,
  download: Download,
  list: HardDrive,
  rename: Pencil,
  upload: Upload,
} as const

const segmentedIconLabel = (Icon: (typeof ACTION_ICONS)[ActionMode], text: string, title: string) => (
  <span className='inline-flex items-center gap-1.5' title={title}>
    <Icon className='size-4 shrink-0' />
    {text}
  </span>
)

const ACTION_SEGMENTED_OPTIONS = ACTION_ORDER.map((value) => ({
  label: segmentedIconLabel(ACTION_ICONS[value], ACTION_META[value].label, ACTION_META[value].description),
  value,
}))

async function fetchFileList(prefix: string): Promise<FileInfo[] | null> {
  try {
    const response = await apiFetch(withSearch(S3_API_PATH, { action: 'list', prefix: listQueryPrefix(prefix) }))
    const json: unknown = await response.json()
    if (!isApiSuccess(json)) return null
    return readFileList(json.data)
  } catch {
    return null
  }
}

async function fetchDownloadUrl(key: string): Promise<string> {
  const response = await apiFetch(withSearch(S3_API_PATH, { action: 'downloadUrl', key }))
  const json: unknown = await response.json()
  const result = isApiSuccess(json) ? readResult('download', json.data) : null
  if (!response.ok || result?.kind !== 'download') throw new Error(readApiError(json, response.status))
  return result.data.downloadUrl
}

export default function S3Page() {
  const { message } = useApp()
  const [action, setAction] = useState<ActionMode>('list')
  const [view, setView] = useState<ResultView>('results')
  const [values, setValues] = useState<S3FormValues>(initialForm)
  const [files, setFiles] = useState<File[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [runState, setRunState] = useState<RunState | null>(null)
  const [payload, setPayload] = useState<unknown>(null)
  const [resultAction, setResultAction] = useState<ActionMode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [fileList, setFileList] = useState<FileInfo[]>([])
  const [imagePreview, setImagePreview] = useState<{ key: string; url: string } | null>(null)
  const [previewLoadingKey, setPreviewLoadingKey] = useState<string | null>(null)

  const requestJson = JSON.stringify(
    buildRequestPreview(
      action,
      values,
      files.map((item) => item.name),
    ),
    null,
    2,
  )
  const rawJson = payload ? JSON.stringify(payload, null, 2) : ''
  const resultData = isApiSuccess(payload) ? payload.data : null

  const applyFiles = (next: FileInfo[] | null) => {
    if (next) setFileList(next)
  }

  useEffect(() => {
    void fetchFileList('').then(applyFiles)
  }, [])

  const updateValues = (patch: Partial<S3FormValues>) => {
    setValues((current) => ({ ...current, ...patch }))
  }

  const selectAction = (nextAction: ActionMode) => {
    setAction(nextAction)
    setError(null)
    setPayload(null)
    setResultAction(null)
    setRunState(null)
  }

  const refreshList = async () => {
    applyFiles(await fetchFileList(values.listPrefix))
  }

  const submit = async () => {
    if (!canSubmit(action, values, files.length)) return

    setIsLoading(true)
    setError(null)
    setPayload(null)

    const startedAt = performance.now()
    const submittedAt = new Date().toLocaleString()

    try {
      const response = await sendRequest(action, values, files)
      const data: unknown = await response.json()
      setRunState({
        durationMs: Math.round(performance.now() - startedAt),
        status: response.status,
        submittedAt,
      })

      if (!response.ok || !isApiSuccess(data)) {
        setError(readApiError(data, response.status))
        return
      }

      setPayload(data)
      setResultAction(action)
      setView('results')

      if (action === 'upload' || action === 'delete' || action === 'rename') {
        applyFiles(await fetchFileList(values.listPrefix))
        setValues((current) => formAfterSuccess(action, current))
        if (action === 'upload') setFiles([])
      }
      if (action === 'list') applyFiles(readFileList(data.data))
    } catch (requestError) {
      setRunState({
        durationMs: Math.round(performance.now() - startedAt),
        status: 0,
        submittedAt,
      })
      setError(requestError instanceof Error ? requestError.message : 'Request failed')
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    setAction('list')
    setValues(initialForm())
    setFiles([])
    setPayload(null)
    setResultAction(null)
    setError(null)
    setRunState(null)
    setCopyState('idle')
  }

  const copyRequestJson = async () => {
    try {
      await navigator.clipboard.writeText(requestJson)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1600)
    } catch {
      setCopyState('failed')
    }
  }

  const acceptFiles = (incoming: File[], replace: boolean) => {
    if (incoming.length === 0) return
    setFiles((current) => {
      const next = replace ? incoming : [...current, ...incoming]
      return next
    })
    if (!values.uploadKey) updateValues({ uploadKey: incoming[0].name })
  }

  const deleteFile = async (key: string) => {
    try {
      const response = await apiFetch(withSearch(S3_API_PATH, { action: 'deleteOne', key }), { method: 'DELETE' })
      const json: unknown = await response.json()
      if (!response.ok || !isApiSuccess(json)) {
        message.error(readApiError(json, response.status))
        return
      }
      message.success('已删除')
      await refreshList()
    } catch {
      message.error('删除失败')
    }
  }

  const downloadFile = async (key: string) => {
    try {
      window.open(await fetchDownloadUrl(key), '_blank', 'noopener')
    } catch (requestError) {
      message.error(requestError instanceof Error ? requestError.message : '下载失败')
    }
  }

  const previewImage = async (key: string) => {
    setPreviewLoadingKey(key)
    try {
      setImagePreview({ key, url: await fetchDownloadUrl(key) })
    } catch (requestError) {
      message.error(requestError instanceof Error ? requestError.message : '预览失败')
    } finally {
      setPreviewLoadingKey(null)
    }
  }

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key)
      message.success('Key 已复制')
    } catch {
      message.error('复制失败')
    }
  }

  return (
    <main className='flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground'>
      <div className='mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6 lg:overflow-hidden lg:px-8'>
        <header className='flex shrink-0 flex-col justify-between gap-3 border-b border-border pb-4 lg:flex-row lg:items-end'>
          <div>
            <h1 className='text-2xl font-semibold text-foreground'>FileS3 功能测试台</h1>
            <p className='mt-1 max-w-2xl text-sm leading-6 text-muted-foreground'>
              验证上传、列表、下载、删除和重命名。测试对象统一放在 dev/ 前缀下。
            </p>
          </div>
          <div className='max-w-full overflow-x-auto'>
            <Segmented
              options={ACTION_SEGMENTED_OPTIONS}
              value={action}
              onChange={(value) => selectAction(value as ActionMode)}
            />
          </div>
        </header>

        <div className='grid min-h-0 flex-1 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]'>
          <S3Form
            action={action}
            copyState={copyState}
            files={files}
            isLoading={isLoading}
            requestJson={requestJson}
            runState={runState}
            values={values}
            onChange={updateValues}
            onCopy={() => void copyRequestJson()}
            onFiles={acceptFiles}
            onRemoveFile={(index) => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            onReset={reset}
            onSubmit={() => void submit()}
          />
          <S3Results
            action={resultAction}
            error={error}
            files={fileList}
            imagePreview={imagePreview}
            payload={resultData}
            previewLoadingKey={previewLoadingKey}
            rawJson={rawJson}
            view={view}
            onClosePreview={() => setImagePreview(null)}
            onCopyKey={(key) => void copyKey(key)}
            onDeleteFile={(key) => void deleteFile(key)}
            onDownloadFile={(key) => void downloadFile(key)}
            onPreviewImage={(key) => void previewImage(key)}
            onRefresh={() => void refreshList()}
            onRenameFile={(key) => {
              setAction('rename')
              updateValues({ renameOldKey: key })
            }}
            onViewChange={setView}
          />
        </div>
      </div>
    </main>
  )
}

async function sendRequest(action: ActionMode, values: S3FormValues, files: File[]) {
  const plan = planSubmit(action, values, files)
  if (plan.kind === 'file') {
    const body = new FormData()
    body.append('file', plan.file)
    if (plan.key) body.append('key', plan.key)
    return apiFetch(withSearch(S3_API_PATH, { action: 'uploadFile' }), { body, method: 'POST' })
  }

  const { request } = plan
  const init = request.body === undefined ? { method: request.method } : jsonInit(request.body, { method: request.method })
  return apiFetch(withSearch(S3_API_PATH, request.search), init)
}
