'use client'

import { useState } from 'react'

import type { FileDocument } from '@pure/file-loaders'
import { apiFetch, jsonInit } from '@/utils/apiFetch'

import { ReadFileForm } from './ReadFileForm'
import { ReadFileResults } from './ReadFileResults'
import {
  READ_FILE_API_PATH,
  SUPPORTED_FORMATS,
  canSubmit,
  downloadResultJson,
  readApiError,
} from './readFileModel'
import type { ApiError, CopyState, RequestMode, ResultView, RunState } from './readFileModel'

export default function ReadFilePage() {
  const [mode, setMode] = useState<RequestMode>('file')
  const [view, setView] = useState<ResultView>('content')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<FileDocument | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [runState, setRunState] = useState<RunState | null>(null)
  const [copyState, setCopyState] = useState<CopyState>('idle')

  const rawJson = result ? JSON.stringify(result, null, 2) : ''

  const pickFile = (nextFile: File | null) => {
    setFile(nextFile)
    setError(null)
    setResult(null)
    setRunState(null)
  }

  const updateUrl = (nextUrl: string) => {
    setUrl(nextUrl)
    setError(null)
  }

  const reset = () => {
    setFile(null)
    setUrl('')
    setResult(null)
    setError(null)
    setRunState(null)
    setCopyState('idle')
  }

  const submit = async () => {
    if (!canSubmit(mode, file, url)) return

    setIsLoading(true)
    setError(null)
    setResult(null)
    setCopyState('idle')

    const startedAt = performance.now()
    const submittedAt = new Date().toLocaleString()

    try {
      let response: Response

      if (mode === 'file' && file) {
        const body = new FormData()
        body.append('file', file)
        response = await apiFetch(READ_FILE_API_PATH, { body, method: 'POST' })
      } else {
        response = await apiFetch(READ_FILE_API_PATH, jsonInit({ url: url.trim() }, { method: 'POST' }))
      }

      const payload = (await response.json()) as FileDocument | ApiError
      const nextRunState: RunState = {
        durationMs: Math.round(performance.now() - startedAt),
        mode,
        status: response.status,
        submittedAt,
      }

      setRunState(nextRunState)

      if (!response.ok) {
        setError(readApiError(payload, response.status))
        return
      }

      setResult(payload as FileDocument)
      setView('content')
    } catch (requestError) {
      setRunState({
        durationMs: Math.round(performance.now() - startedAt),
        mode,
        status: 0,
        submittedAt,
      })
      setError(requestError instanceof Error ? requestError.message : 'Request failed')
    } finally {
      setIsLoading(false)
    }
  }

  const copyJson = async () => {
    if (!rawJson) return
    try {
      await navigator.clipboard.writeText(rawJson)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1600)
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <main className='flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground'>
      <div className='mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6 lg:overflow-hidden lg:px-8'>
        <header className='flex shrink-0 flex-col justify-between gap-3 border-b border-border pb-4 lg:flex-row lg:items-end'>
          <div>
            <h1 className='text-2xl font-semibold text-foreground'>文件解析功能测试台</h1>
            <p className='mt-1 max-w-2xl text-sm leading-6 text-muted-foreground'>
              测试上传文件和远程 URL 两种入口，查看标准化内容、分页块、统计信息和原始 JSON 响应。
            </p>
          </div>
          <div className='flex flex-wrap gap-1.5'>
            {SUPPORTED_FORMATS.map((format) => (
              <span
                key={format}
                className='rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground'
              >
                {format}
              </span>
            ))}
          </div>
        </header>

        <div className='grid min-h-0 flex-1 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]'>
          <ReadFileForm
            file={file}
            isLoading={isLoading}
            mode={mode}
            runState={runState}
            url={url}
            onFile={pickFile}
            onMode={setMode}
            onReset={reset}
            onSubmit={() => void submit()}
            onUrl={updateUrl}
          />
          <ReadFileResults
            copyState={copyState}
            error={error}
            rawJson={rawJson}
            result={result}
            view={view}
            onCopy={() => void copyJson()}
            onDownload={() => downloadResultJson(rawJson, result?.filename ?? 'read-file-result')}
            onViewChange={setView}
          />
        </div>
      </div>
    </main>
  )
}
