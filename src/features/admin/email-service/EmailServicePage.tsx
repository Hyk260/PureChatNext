'use client'

import { Flex } from '@pure/ui'
import { useCallback, useEffect, useState } from 'react'

import { getEmailTemplatePreviewParams } from '@/libs/better-auth/email-templates/preview'
import type {
  EmailTemplateKey,
  EmailTemplateParams,
  RenderedEmailTemplate,
} from '@/libs/better-auth/email-templates/preview'
import { apiFetch, jsonInit } from '@/utils/apiFetch'

import { EmailServiceForm } from './EmailServiceForm'
import { EmailServiceResults } from './EmailServiceResults'
import { clearEmailServiceCache, readEmailServiceCache, writeEmailServiceCache } from './emailServiceCache'
import {
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

export default function EmailServicePage() {
  const [initialCache] = useState(() => readEmailServiceCache())
  const [action, setAction] = useState<ActionMode>(initialCache?.action ?? 'sendMail')
  const [contentMode, setContentMode] = useState<ContentMode>(initialCache?.contentMode ?? 'custom')
  const [rightPanel, setRightPanel] = useState<RightPanelView>(initialCache?.rightPanel ?? 'preview')
  const [view, setView] = useState<ResultView>(initialCache?.view ?? 'summary')
  const [values, setValues] = useState<EmailFormValues>(initialCache?.values ?? initialForm())
  const [renderedTemplate, setRenderedTemplate] = useState<RenderedEmailTemplate | null>(
    initialCache?.renderedTemplate ?? null
  )
  const [templateLabel, setTemplateLabel] = useState(initialCache?.templateLabel ?? DEFAULT_TEMPLATE_LABEL)
  const [templateKey, setTemplateKey] = useState<EmailTemplateKey>(initialCache?.templateKey ?? 'verification')
  const [templateParams, setTemplateParams] = useState<EmailTemplateParams>(
    initialCache?.templateParams ?? getEmailTemplatePreviewParams('verification')
  )
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [runState, setRunState] = useState<RunState | null>(initialCache?.runState ?? null)
  const [payload, setPayload] = useState<ApiSuccess | null>(initialCache?.payload ?? null)
  const [error, setError] = useState<string | null>(initialCache?.error ?? null)
  const [copyState, setCopyState] = useState<CopyState>('idle')

  const requestBody = buildRequestBody(action, values)
  const requestJson = JSON.stringify(requestBody, null, 2)
  const rawJson = payload ? JSON.stringify(payload, null, 2) : ''

  useEffect(() => {
    writeEmailServiceCache({
      action,
      contentMode,
      error,
      payload,
      renderedTemplate,
      rightPanel,
      runState,
      templateKey,
      templateLabel,
      templateParams,
      values,
      view,
    })
  }, [
    action,
    contentMode,
    error,
    payload,
    renderedTemplate,
    rightPanel,
    runState,
    templateKey,
    templateLabel,
    templateParams,
    values,
    view,
  ])

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

  const handleTemplateStateChange = useCallback((state: { key: EmailTemplateKey; params: EmailTemplateParams }) => {
    setTemplateKey(state.key)
    setTemplateParams(state.params)
  }, [])

  const selectAction = (nextAction: ActionMode) => {
    setAction(nextAction)
    setCopyState('idle')
    if (showsTemplatePreview(nextAction, contentMode)) setRightPanel('preview')
  }

  const selectContentMode = (nextMode: ContentMode) => {
    setContentMode(nextMode)
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
    setAction('sendMail')
    setContentMode('custom')
    setRightPanel('preview')
    setView('summary')
    setValues(initialForm())
    setRenderedTemplate(null)
    setTemplateLabel(DEFAULT_TEMPLATE_LABEL)
    setTemplateKey('verification')
    setTemplateParams(getEmailTemplatePreviewParams('verification'))
    setTemplateLoading(false)
    setTemplateError(null)
    setPayload(null)
    setError(null)
    setRunState(null)
    setCopyState('idle')
  }

  const clearCache = () => {
    clearEmailServiceCache()
    reset()
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
      <Flex className='mx-auto size-full min-h-0 max-w-7xl flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6 lg:overflow-hidden lg:px-8'>
        <header className='flex shrink-0 flex-col justify-between gap-3 border-b border-border pb-4 lg:flex-row lg:items-end'>
          <div>
            <h1 className='text-2xl font-semibold text-foreground'>邮件服务测试台</h1>
            <p className='mt-1 max-w-2xl text-sm leading-6 text-muted-foreground'>
              验证 EmailService 的 verify 与 sendMail 路径；Send Mail 支持选择认证模板、调整参数并预览后再发送。
            </p>
          </div>
        </header>

        <div className='grid min-h-0 flex-1 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]'>
          <EmailServiceForm
            action={action}
            contentMode={contentMode}
            copyState={copyState}
            initialTemplateKey={templateKey}
            initialTemplateParams={templateParams}
            isLoading={isLoading}
            requestJson={requestJson}
            runState={runState}
            templateError={templateError}
            templateLoading={templateLoading}
            values={values}
            onChange={updateValues}
            onActionChange={selectAction}
            onClearCache={clearCache}
            onContentModeChange={selectContentMode}
            onCopy={copyRequestJson}
            onReset={reset}
            onSubmit={submit}
            onTemplateChange={handleTemplateChange}
            onTemplateRendered={handleTemplateRendered}
            onTemplateRenderStateChange={handleTemplateRenderStateChange}
            onTemplateStateChange={handleTemplateStateChange}
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
      </Flex>
    </main>
  )
}
