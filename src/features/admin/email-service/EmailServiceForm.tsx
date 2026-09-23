import type { ReactNode } from 'react'
import { Segmented } from 'antd'
import { Clipboard, RefreshCcw, Sparkles } from 'lucide-react'

import { ActionIcon, Button, Input, Select, TextArea } from '@pure/ui'
import { Highlighter } from '@pure/ui/Markdown'

import Scrollbar from '@/components/Scrollbar'
import type { RenderedEmailTemplate } from '@/libs/better-auth/email-templates/preview'

import { EmailTemplateComposer } from '../EmailTemplateComposer'
import {
  ACTION_META,
  CONTENT_MODE_OPTIONS,
  COPY_LABEL,
  EMAIL_ENDPOINT_LABEL,
  PROVIDER_OPTIONS,
  canSubmit,
  providerLabel,
} from './emailServiceModel'
import type { ActionMode, ContentMode, CopyState, EmailFormValues, ProviderOption, RunState } from './emailServiceModel'

const LABEL_CLASS = 'text-sm font-medium text-foreground'

const metaRows = (action: ActionMode, impl: ProviderOption, runState: RunState | null): Array<[string, string]> => [
  ['Endpoint', EMAIL_ENDPOINT_LABEL],
  ['Action', action],
  ['Provider', providerLabel(impl)],
  ['状态码', runState ? String(runState.status) : 'N/A'],
  ['耗时', runState ? `${runState.durationMs.toLocaleString()} ms` : 'N/A'],
  ['提交时间', runState?.submittedAt ?? 'N/A'],
]

function Field({
  children,
  hint,
  htmlFor,
  label,
}: {
  children: ReactNode
  hint?: string
  htmlFor?: string
  label: string
}) {
  return (
    <div>
      {htmlFor ? (
        <label className={LABEL_CLASS} htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <div className={LABEL_CLASS}>{label}</div>
      )}
      <div className='mt-2'>{children}</div>
      {hint ? <p className='mt-2 text-xs leading-5 text-muted-foreground'>{hint}</p> : null}
    </div>
  )
}

export function EmailServiceForm({
  action,
  contentMode,
  copyState,
  isLoading,
  onChange,
  onContentModeChange,
  onCopy,
  onReset,
  onSubmit,
  onTemplateChange,
  onTemplateRendered,
  onTemplateRenderStateChange,
  requestJson,
  runState,
  templateError,
  templateLoading,
  values,
}: {
  action: ActionMode
  contentMode: ContentMode
  copyState: CopyState
  isLoading: boolean
  onChange: (patch: Partial<EmailFormValues>) => void
  onContentModeChange: (mode: ContentMode) => void
  onCopy: () => void
  onReset: () => void
  onSubmit: () => void
  onTemplateChange: (key: string, label: string) => void
  onTemplateRendered: (template: RenderedEmailTemplate) => void
  onTemplateRenderStateChange: (state: { error: string | null; isLoading: boolean }) => void
  requestJson: string
  runState: RunState | null
  templateError: string | null
  templateLoading: boolean
  values: EmailFormValues
}) {
  const canSend = canSubmit(action, values, {
    contentMode,
    templateError,
    templateLoading,
  })

  return (
    <section className='flex min-h-[32rem] flex-col overflow-hidden rounded-card border border-border bg-card lg:h-full lg:min-h-0'>
      <Scrollbar className='min-h-0 flex-1'>
        <div className='flex flex-col gap-4 p-4'>
          <p className='text-sm leading-6 text-muted-foreground'>{ACTION_META[action].description}</p>

          <Field htmlFor='email-service-impl' label='Provider · 邮件提供商'>
            <Select
              aria-label='邮件提供商'
              className='w-full'
              options={PROVIDER_OPTIONS.map((option) => ({
                label: option.label,
                value: option.value || '__default__',
              }))}
              style={{ width: '100%' }}
              value={values.impl || '__default__'}
              onChange={(value) => onChange({ impl: (value === '__default__' ? '' : value) as ProviderOption })}
            />
          </Field>

          {action === 'sendMail' ? (
            <SendMailFields
              contentMode={contentMode}
              values={values}
              onChange={onChange}
              onContentModeChange={onContentModeChange}
              onTemplateChange={onTemplateChange}
              onTemplateRendered={onTemplateRendered}
              onTemplateRenderStateChange={onTemplateRenderStateChange}
            />
          ) : null}

          <div className='grid grid-cols-[1fr_auto] gap-2'>
            <Button
              disabled={!canSend}
              icon={<Sparkles className='size-4' />}
              loading={isLoading}
              type='primary'
              onClick={onSubmit}
            >
              发送请求
            </Button>
            <ActionIcon icon={RefreshCcw} title='重置测试' onClick={onReset} />
          </div>

          <dl className='grid gap-2 border-t border-border pt-4 text-sm'>
            {metaRows(action, values.impl, runState).map(([label, value]) => (
              <div key={label} className='flex-between gap-4'>
                <dt className='text-muted-foreground'>{label}</dt>
                <dd className='text-right font-mono text-xs text-foreground'>{value}</dd>
              </div>
            ))}
          </dl>

          <div>
            <div className='flex-between gap-3'>
              <h2 className='text-sm font-semibold text-foreground'>请求体</h2>
              <Button icon={<Clipboard className='size-3.5' />} size='small' onClick={onCopy}>
                {COPY_LABEL[copyState]}
              </Button>
            </div>
            <Scrollbar maxHeight='10rem' className='mt-3 overflow-hidden rounded-lg ring-1 ring-border'>
              <Highlighter
                actionIconSize='small'
                copyable={false}
                language='json'
                showLanguage={false}
                styles={{ content: { height: 'auto' } }}
                variant='borderless'
                wrap
              >
                {requestJson}
              </Highlighter>
            </Scrollbar>
          </div>
        </div>
      </Scrollbar>
    </section>
  )
}

function SendMailFields({
  contentMode,
  onChange,
  onContentModeChange,
  onTemplateChange,
  onTemplateRendered,
  onTemplateRenderStateChange,
  values,
}: {
  contentMode: ContentMode
  onChange: (patch: Partial<EmailFormValues>) => void
  onContentModeChange: (mode: ContentMode) => void
  onTemplateChange: (key: string, label: string) => void
  onTemplateRendered: (template: RenderedEmailTemplate) => void
  onTemplateRenderStateChange: (state: { error: string | null; isLoading: boolean }) => void
  values: EmailFormValues
}) {
  return (
    <div className='grid min-w-0 gap-4'>
      <Field label='内容来源'>
        <Segmented
          block
          options={CONTENT_MODE_OPTIONS}
          value={contentMode}
          onChange={(value) => onContentModeChange(value as ContentMode)}
        />
      </Field>

      <Field hint='多个收件人可用逗号或换行分隔。' htmlFor='email-service-to' label='收件人 · To'>
        <Input
          id='email-service-to'
          placeholder='recipient@example.com'
          value={values.to}
          onChange={(event) => onChange({ to: event.target.value })}
        />
      </Field>

      <Field htmlFor='email-service-from' label='发件人 · From'>
        <Input
          id='email-service-from'
          placeholder='留空则使用 SMTP_FROM / RESEND_FROM'
          value={values.from}
          onChange={(event) => onChange({ from: event.target.value })}
        />
      </Field>

      {contentMode === 'template' ? (
        <EmailTemplateComposer
          onRendered={onTemplateRendered}
          onRenderStateChange={onTemplateRenderStateChange}
          onTemplateChange={onTemplateChange}
        />
      ) : (
        <CustomContentFields values={values} onChange={onChange} />
      )}

      <Field htmlFor='email-service-reply-to' label='回复地址 · Reply-To'>
        <Input
          id='email-service-reply-to'
          placeholder='support@example.com'
          value={values.replyTo}
          onChange={(event) => onChange({ replyTo: event.target.value })}
        />
      </Field>
    </div>
  )
}

function CustomContentFields({
  onChange,
  values,
}: {
  onChange: (patch: Partial<EmailFormValues>) => void
  values: EmailFormValues
}) {
  return (
    <>
      <Field htmlFor='email-service-subject' label='主题 · Subject'>
        <Input
          id='email-service-subject'
          placeholder='邮件主题'
          value={values.subject}
          onChange={(event) => onChange({ subject: event.target.value })}
        />
      </Field>
      <Field htmlFor='email-service-text' label='纯文本 · Text'>
        <TextArea
          id='email-service-text'
          placeholder='Plain text body'
          rows={3}
          value={values.text}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      </Field>
      <Field htmlFor='email-service-html' label='HTML 正文 · HTML'>
        <TextArea
          className='font-mono text-xs'
          id='email-service-html'
          placeholder='<p>HTML body</p>'
          rows={4}
          value={values.html}
          onChange={(event) => onChange({ html: event.target.value })}
        />
      </Field>
    </>
  )
}
