import { Segmented } from 'antd'
import { Code2, ExternalLink, Eye, FileJson, Mail, ShieldCheck } from 'lucide-react'

import { Alert, Flex } from '@pure/ui'
import { Highlighter } from '@pure/ui/Markdown'

import Scrollbar from '@/components/Scrollbar'
import type { RenderedEmailTemplate } from '@/libs/better-auth/email-templates/preview'

import { EmailTemplatePreviewBlock } from '../EmailTemplatePreviewBlock'
import { buildResultSummary, isSendMailResult, isVerifyResult, providerLabel } from './emailServiceModel'
import type {
  ActionMode,
  ApiSuccess,
  ContentMode,
  ProviderOption,
  ResultView,
  RightPanelView,
  RunState,
  SendMailResult,
  VerifyResult,
} from './emailServiceModel'

const TAG_OK = 'rounded-md bg-green-tint px-2 py-1 text-xs font-medium text-green'
const TAG_ERR = 'rounded-md bg-red-tint px-2 py-1 text-xs font-medium text-red'

const segmentedIconLabel = (Icon: typeof Mail, text: string) => (
  <span className='inline-flex items-center gap-1.5'>
    <Icon className='size-4 shrink-0' />
    {text}
  </span>
)

const RESULT_VIEW_OPTIONS = [
  { label: segmentedIconLabel(FileJson, '摘要'), value: 'summary' },
  { label: segmentedIconLabel(Code2, 'JSON'), value: 'json' },
]

const RIGHT_PANEL_OPTIONS = [
  { label: segmentedIconLabel(Eye, '模板预览'), value: 'preview' },
  { label: segmentedIconLabel(FileJson, '请求响应'), value: 'response' },
]

function requestStatusAlert(error: string | null, completedAction?: ActionMode) {
  if (error) return <Alert showIcon description={error} title='请求失败' type='error' />
  if (completedAction) {
    return (
      <Alert
        showIcon
        description={`${completedAction} 返回成功，下面可查看摘要与原始 JSON。`}
        title='请求完成'
        type='success'
      />
    )
  }
  return <Alert showIcon description='选择方法并填写参数后发送请求，响应会显示在这里。' title='等待请求' type='info' />
}

function EmptyResult({ description, title }: { description: string; title: string }) {
  return (
    <div className='grid min-h-40 place-items-center px-6 py-10 text-center'>
      <div>
        <Mail className='mx-auto size-8 text-muted-foreground' />
        <div className='mt-3 text-sm font-semibold text-foreground'>{title}</div>
        <div className='mt-1 text-sm text-muted-foreground'>{description}</div>
      </div>
    </div>
  )
}

function VerifySummary({ result }: { result: VerifyResult }) {
  return (
    <article className='rounded-lg border border-border p-4'>
      <div className='flex items-start gap-3'>
        <ShieldCheck className={`mt-0.5 size-5 shrink-0 ${result.valid ? 'text-green' : 'text-red'}`} />
        <div>
          <div className='text-base font-semibold text-foreground'>
            {result.valid ? 'SMTP 连接验证通过' : 'SMTP 连接验证失败'}
          </div>
          <p className='mt-2 text-sm leading-6 text-muted-foreground'>
            {result.valid
              ? 'EmailService.verify() 返回 true，当前 Provider 配置可用。'
              : 'EmailService.verify() 返回 false，请检查 SMTP 环境变量。'}
          </p>
          <span className={`mt-3 inline-flex ${result.valid ? TAG_OK : TAG_ERR}`}>valid: {String(result.valid)}</span>
        </div>
      </div>
    </article>
  )
}

function SendMailSummary({ result }: { result: SendMailResult }) {
  return (
    <article className='rounded-lg border border-border p-4'>
      <div className='flex items-start gap-3'>
        <Mail className='mt-0.5 size-5 shrink-0 text-primary' />
        <div className='min-w-0 flex-1'>
          <div className='text-base font-semibold text-foreground'>邮件发送成功</div>
          <p className='mt-2 text-sm leading-6 text-muted-foreground'>
            EmailService.sendMail() 已完成，可在下方查看 messageId 与预览链接。
          </p>
          <dl className='mt-4 grid gap-3 text-sm'>
            <div>
              <dt className='text-xs font-medium text-muted-foreground'>Message ID</dt>
              <dd className='mt-1 break-all font-mono text-xs text-foreground'>{result.messageId}</dd>
            </div>
            {result.previewUrl ? (
              <div>
                <dt className='text-xs font-medium text-muted-foreground'>Preview URL</dt>
                <dd className='mt-1'>
                  <a
                    className='inline-flex items-center gap-1 break-all text-sm font-medium text-primary hover:opacity-80'
                    href={result.previewUrl}
                    rel='noreferrer'
                    target='_blank'
                  >
                    {result.previewUrl}
                    <ExternalLink className='size-3.5 shrink-0' />
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </article>
  )
}

function ResultBody({
  payload,
  rawJson,
  view,
}: {
  payload: ApiSuccess | null
  rawJson: string
  view: ResultView
}) {
  if (view === 'json') {
    if (!rawJson) {
      return <EmptyResult description='发送请求后会在这里高亮展示原始响应。' title='还没有响应 JSON' />
    }
    return (
      <Highlighter
        actionIconSize='small'
        className='rounded-lg ring-1 ring-border'
        language='json'
        styles={{ content: { height: 'auto' } }}
        variant='borderless'
        wrap
      >
        {rawJson}
      </Highlighter>
    )
  }

  const result = payload?.result ?? null
  if (isVerifyResult(result)) return <VerifySummary result={result} />
  if (isSendMailResult(result)) return <SendMailSummary result={result} />
  return <EmptyResult description='发送请求后会展示 verify 或 sendMail 结果。' title='还没有响应' />
}

export function EmailServiceResults({
  action,
  contentMode,
  error,
  onRightPanelChange,
  onViewChange,
  payload,
  provider,
  rawJson,
  rightPanel,
  runState,
  templateError,
  templateLabel,
  templateLoading,
  templateRendered,
  view,
}: {
  action: ActionMode
  contentMode: ContentMode
  error: string | null
  onRightPanelChange: (panel: RightPanelView) => void
  onViewChange: (view: ResultView) => void
  payload: ApiSuccess | null
  provider: ProviderOption
  rawJson: string
  rightPanel: RightPanelView
  runState: RunState | null
  templateError: string | null
  templateLabel: string
  templateLoading: boolean
  templateRendered: RenderedEmailTemplate | null
  view: ResultView
}) {
  const result = payload?.result ?? null
  const verifyResult = isVerifyResult(result) ? result : null
  const sendMailResult = isSendMailResult(result) ? result : null
  const showTemplatePreview = action === 'sendMail' && contentMode === 'template'
  const showingPreview = showTemplatePreview && rightPanel === 'preview'

  const summary = buildResultSummary({
    action,
    payloadAction: payload?.action,
    provider: providerLabel(provider),
    runState,
    sendMailResult,
    verifyResult,
  })

  return (
    <section className='flex min-h-[32rem] min-w-0 flex-col overflow-hidden rounded-card border border-border bg-card lg:h-full lg:min-h-0'>
      <Flex className='gap-2 shrink-0 flex-col space-y-3 border-b border-border p-4'>
        {requestStatusAlert(error, payload?.action)}
        <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
          <dl className='grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4'>
            {summary.map((item) => (
              <div key={item.label} className='rounded-lg bg-secondary px-3 py-2'>
                <dt className='text-xs text-muted-foreground'>{item.label}</dt>
                <dd className='mt-1 truncate text-sm font-semibold text-foreground' title={item.value}>
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className='flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center'>
            {showTemplatePreview ? (
              <Segmented
                options={RIGHT_PANEL_OPTIONS}
                size='small'
                value={rightPanel}
                onChange={(value) => onRightPanelChange(value as RightPanelView)}
              />
            ) : null}
            {showingPreview ? null : (
              <Segmented
                options={RESULT_VIEW_OPTIONS}
                size='small'
                value={view}
                onChange={(value) => onViewChange(value as ResultView)}
              />
            )}
          </div>
        </div>
      </Flex>

      <Scrollbar className='min-h-0 flex-1'>
        <div className='min-w-0 p-4'>
          {showingPreview ? (
            <EmailTemplatePreviewBlock
              error={templateError}
              isLoading={templateLoading}
              label={templateLabel}
              template={templateRendered}
            />
          ) : (
            <ResultBody payload={payload} rawJson={rawJson} view={view} />
          )}
        </div>
      </Scrollbar>
    </section>
  )
}
