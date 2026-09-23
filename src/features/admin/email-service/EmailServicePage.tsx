'use client'

import { useCallback, useState } from 'react'
import { Segmented } from 'antd'
import { Mail, ShieldCheck } from 'lucide-react'

import type { RenderedEmailTemplate } from '@/libs/better-auth/email-templates/preview'
import { apiFetch, jsonInit } from '@/utils/apiFetch'

import { EmailServiceForm } from './EmailServiceForm'
import { EmailServiceResults } from './EmailServiceResults'
import {
  ACTION_META,
  ACTION_ORDER,
  DEFAULT_TEMPLATE_LABEL,
  EMAIL_API_PATH,
  buildRequestBody,
  canSubmit,
  initialForm,
  showsTemplatePreview,
} from './emailServiceModel'
import type {
  ActionMode,
  ApiFailure,
  ApiSuccess,
  ContentMode,
  CopyState,
  EmailFormValues,
  ResultView,
  RightPanelView,
  RunState,
} from './emailServiceModel'

const ACTION_ICONS = {
  sendMail: Mail,
  verify: ShieldCheck,
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

export default function EmailServicePage() {
  const [action, setAction] = useState<ActionMode>('verify')
  const [contentMode, setContentMode] = useState<ContentMode>('custom')
  const [rightPanel, setRightPanel] = useState<RightPanelView>('preview')
  const [view, setView] = useState<ResultView>('summary')
  const [values, setValues] = useState<EmailFormValues>(initialForm)
  const [renderedTemplate, setRenderedTemplate] = useState<RenderedEmailTemplate | null>(null)
  const [templateLabel, setTemplateLabel] = useState(DEFAULT_TEMPLATE_LABEL)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [runState, setRunState] = useState<RunState | null>(null)
  const [payload, setPayload] = useState<ApiSuccess | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<CopyState>('idle')

  const requestBody = buildRequestBody(action, values)
  const requestJson = JSON.stringify(requestBody, null, 2)
  const rawJson = payload ? JSON.stringify(payload, null, 2) : ''

  const updateValues = (patch: Partial<EmailFormValues>) => {
    if (patch.to !== undefined || patch.subject !== undefined || patch.text !== undefined || patch.html !== undefined) {
      setError(null)
    }
    setValues((current) => ({ ...current, ...patch }))
  }

  const handleTemplateRendered = useCallback((template: RenderedEmailTemplate) => {
    setRenderedTemplate(template)
    setValues((current) => ({
      ...current,
      html: template.html,
      subject: template.subject,
      text: template.text,
    }))
  }, [])

  const handleTemplateRenderStateChange = useCallback((state: { error: string | null; isLoading: boolean }) => {
    setTemplateLoading(state.isLoading)
    setTemplateError(state.error)
  }, [])

  const handleTemplateChange = useCallback((_key: string, label: string) => {
    setTemplateLabel(label)
  }, [])

  const selectAction = (nextAction: ActionMode) => {
    setAction(nextAction)
    setError(null)
    setPayload(null)
    setRunState(null)
    setCopyState('idle')
    if (showsTemplatePreview(nextAction, contentMode)) setRightPanel('preview')
  }

  const selectContentMode = (nextMode: ContentMode) => {
    setContentMode(nextMode)
    setError(null)
    setPayload(null)
    setRunState(null)
    setCopyState('idle')
    setRightPanel(nextMode === 'template' ? 'preview' : 'response')
  }

  const submit = async () => {
    if (!canSubmit(action, values, { contentMode, templateError, templateLoading })) return

    setIsLoading(true)
    setError(null)
    setPayload(null)
    setCopyState('idle')

    const startedAt = performance.now()
    const submittedAt = new Date().toLocaleString()

    try {
      const response = await apiFetch(EMAIL_API_PATH, jsonInit(requestBody, { method: 'POST' }))
      const data = (await response.json()) as ApiSuccess | ApiFailure

      setRunState({
        durationMs: Math.round(performance.now() - startedAt),
        status: response.status,
        submittedAt,
      })

      if (!response.ok || !data.success) {
        setError('error' in data ? data.error : `Request failed with ${response.status}`)
        return
      }

      setPayload(data)
      setView('summary')
      if (showsTemplatePreview(action, contentMode)) setRightPanel('response')
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
    setAction('verify')
    setContentMode('custom')
    setRightPanel('preview')
    setValues(initialForm())
    setRenderedTemplate(null)
    setTemplateLabel(DEFAULT_TEMPLATE_LABEL)
    setTemplateLoading(false)
    setTemplateError(null)
    setPayload(null)
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

  return (
    <main className='flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground'>
      <div className='mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6 lg:overflow-hidden lg:px-8'>
        <header className='flex shrink-0 flex-col justify-between gap-3 border-b border-border pb-4 lg:flex-row lg:items-end'>
          <div>
            <h1 className='text-2xl font-semibold text-foreground'>邮件服务测试台</h1>
            <p className='mt-1 max-w-2xl text-sm leading-6 text-muted-foreground'>
              验证 EmailService 的 verify 与 sendMail 路径；Send Mail 支持选择认证模板、调整参数并预览后再发送。
            </p>
          </div>
          <Segmented
            className='shrink-0'
            options={ACTION_SEGMENTED_OPTIONS}
            value={action}
            onChange={(value) => selectAction(value as ActionMode)}
          />
        </header>

        <div className='grid min-h-0 flex-1 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]'>
          <EmailServiceForm
            action={action}
            contentMode={contentMode}
            copyState={copyState}
            isLoading={isLoading}
            requestJson={requestJson}
            runState={runState}
            templateError={templateError}
            templateLoading={templateLoading}
            values={values}
            onChange={updateValues}
            onContentModeChange={selectContentMode}
            onCopy={() => void copyRequestJson()}
            onReset={reset}
            onSubmit={() => void submit()}
            onTemplateChange={handleTemplateChange}
            onTemplateRendered={handleTemplateRendered}
            onTemplateRenderStateChange={handleTemplateRenderStateChange}
          />
          <EmailServiceResults
            action={action}
            contentMode={contentMode}
            error={error}
            payload={payload}
            provider={values.impl}
            rawJson={rawJson}
            rightPanel={rightPanel}
            runState={runState}
            templateError={templateError}
            templateLabel={templateLabel}
            templateLoading={templateLoading}
            templateRendered={renderedTemplate}
            view={view}
            onRightPanelChange={setRightPanel}
            onViewChange={setView}
          />
        </div>
      </div>
    </main>
  )
}
