'use client'

import { Input, Select, Text } from '@pure/ui'
import { useEffect, useMemo, useRef, useState } from 'react'

import { EMAIL_TEMPLATE_CATALOG, EMAIL_TEMPLATE_PREVIEW_MOCK, getEmailTemplatePreviewParams } from '@/libs/better-auth/email-templates/preview'
import { apiFetch, jsonInit } from '@/utils/apiFetch'
import type {
  EmailTemplateKey,
  EmailTemplateParamField,
  EmailTemplateParams,
  RenderedEmailTemplate,
} from '@/libs/better-auth/email-templates/preview'

type Props = {
  initialTemplateKey?: EmailTemplateKey
  initialTemplateParams?: EmailTemplateParams
  onRendered: (template: RenderedEmailTemplate) => void
  onRenderError?: (error: string | null) => void
  onRenderStateChange?: (state: { error: string | null; isLoading: boolean }) => void
  onTemplateStateChange?: (state: { key: EmailTemplateKey; params: EmailTemplateParams }) => void
  onTemplateChange?: (key: EmailTemplateKey, label: string) => void
}

const PARAM_LABELS: Record<EmailTemplateParamField, string> = {
  expiresInSeconds: '过期时间（秒）',
  otp: 'OTP 验证码',
  url: '链接 URL',
  userName: '用户名（可选）',
}

const TEMPLATE_OPTIONS = EMAIL_TEMPLATE_CATALOG.map(({ key, label }) => ({ value: key, label }))

const PARAM_PLACEHOLDERS: Record<EmailTemplateParamField, string> = {
  expiresInSeconds: '3600',
  otp: '123456',
  url: EMAIL_TEMPLATE_PREVIEW_MOCK.url,
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

export function EmailTemplateComposer({
  initialTemplateKey,
  initialTemplateParams,
  onRendered,
  onRenderError,
  onRenderStateChange,
  onTemplateStateChange,
  onTemplateChange,
}: Props) {
  const [activeTemplate, setActiveTemplate] = useState<EmailTemplateKey>(
    () => initialTemplateKey ?? EMAIL_TEMPLATE_CATALOG[0]!.key
  )
  const [params, setParams] = useState<EmailTemplateParams>(
    () => initialTemplateParams ?? getDefaultTemplateParams(initialTemplateKey)
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onRenderedRef = useRef(onRendered)
  const onRenderErrorRef = useRef(onRenderError)
  const onRenderStateChangeRef = useRef(onRenderStateChange)
  const onTemplateStateChangeRef = useRef(onTemplateStateChange)
  const onTemplateChangeRef = useRef(onTemplateChange)

  useEffect(() => {
    onRenderedRef.current = onRendered
    onRenderErrorRef.current = onRenderError
    onRenderStateChangeRef.current = onRenderStateChange
    onTemplateStateChangeRef.current = onTemplateStateChange
    onTemplateChangeRef.current = onTemplateChange
  })

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
    onTemplateStateChangeRef.current?.({ key: activeTemplate, params })
  }, [activeTemplate, params])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setIsLoading(true)
      setError(null)
      onRenderErrorRef.current?.(null)

      try {
        const response = await apiFetch(
          '/api/admin/email',
          jsonInit(
            {
              action: 'renderTemplate',
              params,
              template: activeTemplate,
            },
            { method: 'POST' }
          )
        )
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
  const defaultParams = getDefaultTemplateParams(activeTemplate)

  const selectTemplate = (key: EmailTemplateKey) => {
    setParams((current) => {
      if (current.url !== defaultParams.url) return current
      return { ...current, url: getDefaultTemplateParams(key).url }
    })
    setActiveTemplate(key)
  }

  return (
    <div className='min-w-0'>
      <label className='text-sm font-medium text-foreground' htmlFor='email-template-select'>
        邮件模板
      </label>
      <Select
        id='email-template-select'
        value={activeTemplate}
        onChange={selectTemplate}
        options={TEMPLATE_OPTIONS}
        className='mt-2 w-full'
      />

      <div className='mt-4 grid min-w-0 gap-4'>
        {activeParams.map((field) => (
          <div key={field} className='min-w-0'>
            <label
              className='text-sm font-medium text-foreground'
              htmlFor={`email-template-param-${activeTemplate}-${field}`}
            >
              {PARAM_LABELS[field]}
            </label>
            <Input
              id={`email-template-param-${activeTemplate}-${field}`}
              type={field === 'expiresInSeconds' ? 'number' : 'text'}
              min={field === 'expiresInSeconds' ? 1 : undefined}
              value={paramValue(field)}
              onChange={(event) => updateParam(field, event.target.value)}
              placeholder={field === 'url' ? defaultParams.url : PARAM_PLACEHOLDERS[field]}
              className='mt-2 w-full min-w-0'
            />
          </div>
        ))}
        <Text as='p' fontSize={12} type='secondary' className='leading-5'>
          修改参数后约 300ms 自动刷新预览，发送时将使用当前渲染结果。
        </Text>
      </div>
    </div>
  )
}

export function getDefaultTemplateParams(key: EmailTemplateKey = 'verification'): EmailTemplateParams {
  return getEmailTemplatePreviewParams(key)
}
