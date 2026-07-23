'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  EMAIL_TEMPLATE_CATALOG,
  EMAIL_TEMPLATE_PREVIEW_MOCK,
  type EmailTemplateKey,
  type EmailTemplateParamField,
  type EmailTemplateParams,
  type RenderedEmailTemplate,
} from '@/libs/better-auth/email-templates/preview'

type Props = {
  onRendered: (template: RenderedEmailTemplate) => void
  onRenderError?: (error: string | null) => void
  onRenderStateChange?: (state: { error: string | null; isLoading: boolean }) => void
  onTemplateChange?: (key: EmailTemplateKey, label: string) => void
}

const PARAM_LABELS: Record<EmailTemplateParamField, string> = {
  expiresInSeconds: '过期时间（秒）',
  otp: 'OTP 验证码',
  url: '链接 URL',
  userName: '用户名（可选）',
}

const PARAM_PLACEHOLDERS: Record<EmailTemplateParamField, string> = {
  expiresInSeconds: '3600',
  otp: '123456',
  url: 'https://localhost:3000/auth/verify?token=preview-token',
  userName: 'Preview User',
}

type RenderTemplateSuccess = {
  action: 'renderTemplate'
  result: RenderedEmailTemplate
  success: true
}

type RenderTemplateFailure = {
  error: string
  success: false
}

export function EmailTemplateComposer({ onRendered, onRenderError, onRenderStateChange, onTemplateChange }: Props) {
  const [activeTemplate, setActiveTemplate] = useState<EmailTemplateKey>(EMAIL_TEMPLATE_CATALOG[0]!.key)
  const [params, setParams] = useState<EmailTemplateParams>({ ...EMAIL_TEMPLATE_PREVIEW_MOCK })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onRenderedRef = useRef(onRendered)
  const onRenderErrorRef = useRef(onRenderError)
  const onRenderStateChangeRef = useRef(onRenderStateChange)
  const onTemplateChangeRef = useRef(onTemplateChange)

  onRenderedRef.current = onRendered
  onRenderErrorRef.current = onRenderError
  onRenderStateChangeRef.current = onRenderStateChange
  onTemplateChangeRef.current = onTemplateChange

  const activeEntry = useMemo(
    () => EMAIL_TEMPLATE_CATALOG.find((entry) => entry.key === activeTemplate),
    [activeTemplate]
  )

  useEffect(() => {
    if (!activeEntry) {
      return
    }

    onTemplateChangeRef.current?.(activeEntry.key, activeEntry.label)
  }, [activeEntry])

  useEffect(() => {
    onRenderStateChangeRef.current?.({ error, isLoading })
  }, [error, isLoading])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setIsLoading(true)
      setError(null)
      onRenderErrorRef.current?.(null)

      try {
        const response = await fetch('/api/dev/email', {
          body: JSON.stringify({
            action: 'renderTemplate',
            params,
            template: activeTemplate,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        })
        const data = (await response.json()) as RenderTemplateSuccess | RenderTemplateFailure

        if (cancelled) {
          return
        }

        if (!response.ok || !data.success) {
          const message = 'error' in data ? data.error : `Request failed with ${response.status}`
          setError(message)
          onRenderErrorRef.current?.(message)
          return
        }

        onRenderedRef.current(data.result)
      } catch (requestError) {
        if (cancelled) {
          return
        }

        const message = requestError instanceof Error ? requestError.message : 'Request failed'
        setError(message)
        onRenderErrorRef.current?.(message)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [activeTemplate, params])

  const updateParam = (field: EmailTemplateParamField, value: string) => {
    setParams((current) => {
      if (field === 'expiresInSeconds') {
        const parsed = Number.parseInt(value, 10)

        return {
          ...current,
          expiresInSeconds: Number.isFinite(parsed) ? parsed : current.expiresInSeconds,
        }
      }

      if (field === 'userName') {
        return {
          ...current,
          userName: value,
        }
      }

      return {
        ...current,
        [field]: value,
      }
    })
  }

  const paramValue = (field: EmailTemplateParamField) => {
    if (field === 'expiresInSeconds') {
      return String(params.expiresInSeconds ?? EMAIL_TEMPLATE_PREVIEW_MOCK.expiresInSeconds)
    }

    if (field === 'userName') {
      return params.userName ?? ''
    }

    return params[field] ?? ''
  }

  const activeParams = activeEntry?.params ?? []

  return (
    <div className='min-w-0'>
      <label className='text-sm font-medium text-slate-800' htmlFor='email-template-select'>
        认证模板
      </label>
      <select
        id='email-template-select'
        value={activeTemplate}
        onChange={(event) => setActiveTemplate(event.target.value as EmailTemplateKey)}
        className='mt-2 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-3 focus:ring-cyan-100'
      >
        {EMAIL_TEMPLATE_CATALOG.map((entry) => (
          <option key={entry.key} value={entry.key}>
            {entry.label}
          </option>
        ))}
      </select>

      <div className='mt-4 grid min-w-0 gap-4'>
        {activeParams.map((field) => (
          <div key={field} className='min-w-0'>
            <label
              className='text-sm font-medium text-slate-800'
              htmlFor={`email-template-param-${activeTemplate}-${field}`}
            >
              {PARAM_LABELS[field]}
            </label>
            <input
              id={`email-template-param-${activeTemplate}-${field}`}
              type={field === 'expiresInSeconds' ? 'number' : 'text'}
              min={field === 'expiresInSeconds' ? 1 : undefined}
              value={paramValue(field)}
              onChange={(event) => updateParam(field, event.target.value)}
              placeholder={PARAM_PLACEHOLDERS[field]}
              className='mt-2 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-3 focus:ring-cyan-100'
            />
          </div>
        ))}
        <p className='text-xs leading-5 text-slate-500'>修改参数后约 300ms 自动刷新预览，发送时将使用当前渲染结果。</p>
      </div>
    </div>
  )
}

export function getDefaultTemplateParams(): EmailTemplateParams {
  return { ...EMAIL_TEMPLATE_PREVIEW_MOCK }
}
