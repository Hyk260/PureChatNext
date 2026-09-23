export type ActionMode = 'verify' | 'sendMail'
export type ContentMode = 'custom' | 'template'
export type ResultView = 'summary' | 'json'
export type RightPanelView = 'preview' | 'response'
export type ProviderOption = '' | 'nodemailer' | 'resend'
export type CopyState = 'idle' | 'copied' | 'failed'

export type VerifyResult = {
  valid: boolean
}

export type SendMailResult = {
  messageId: string
  previewUrl?: string
}

export type ApiSuccess = {
  action: ActionMode
  result: VerifyResult | SendMailResult
  success: true
}

export type ApiFailure = {
  error: string
  success: false
}

export type RunState = {
  durationMs: number
  status: number
  submittedAt: string
}

export type EmailFormValues = {
  from: string
  html: string
  impl: ProviderOption
  replyTo: string
  subject: string
  text: string
  to: string
}

export type SummaryItem = {
  label: string
  value: string
}

export const EMAIL_API_PATH = '/api/admin/email'
export const EMAIL_ENDPOINT_LABEL = 'POST /api/admin/email'

export const COPY_LABEL: Record<CopyState, string> = {
  idle: '复制',
  copied: '已复制',
  failed: '复制失败',
}

export const ACTION_ORDER: ActionMode[] = ['sendMail', 'verify']

export const ACTION_META: Record<ActionMode, { description: string; label: string }> = {
  sendMail: {
    description: '发送测试邮件并查看 messageId / previewUrl',
    label: 'Send Mail',
  },
  verify: {
    description: '验证 SMTP 连接配置（Nodemailer 专用）',
    label: 'Verify',
  },
}

export const PROVIDER_OPTIONS: Array<{ label: string; value: ProviderOption }> = [
  { label: 'Env 默认 · default', value: '' },
  { label: 'Nodemailer (SMTP)', value: 'nodemailer' },
  { label: 'Resend', value: 'resend' },
]

export const CONTENT_MODE_OPTIONS: Array<{ label: string; value: ContentMode }> = [
  { label: '自定义内容', value: 'custom' },
  { label: '认证模板', value: 'template' },
]

export const EXAMPLE_SEND_MAIL = {
  from: '',
  html: '<p>这是一封来自 <strong>EmailService</strong> 测试台的邮件。</p>',
  replyTo: '',
  subject: 'EmailService 测试',
  text: '这是一封来自 EmailService 测试台的邮件。',
  to: 'recipient@example.com',
} as const

export const DEFAULT_TEMPLATE_LABEL = '注册验证'

export const initialForm = (): EmailFormValues => ({
  from: EXAMPLE_SEND_MAIL.from,
  html: EXAMPLE_SEND_MAIL.html,
  impl: '',
  replyTo: EXAMPLE_SEND_MAIL.replyTo,
  subject: EXAMPLE_SEND_MAIL.subject,
  text: EXAMPLE_SEND_MAIL.text,
  to: EXAMPLE_SEND_MAIL.to,
})

export const isVerifyResult = (value: VerifyResult | SendMailResult | null): value is VerifyResult =>
  Boolean(value && 'valid' in value)

export const isSendMailResult = (value: VerifyResult | SendMailResult | null): value is SendMailResult =>
  Boolean(value && 'messageId' in value)

export const providerLabel = (impl: ProviderOption) =>
  PROVIDER_OPTIONS.find((option) => option.value === impl)?.label ?? 'Env 默认'

export const showsTemplatePreview = (action: ActionMode, contentMode: ContentMode) =>
  action === 'sendMail' && contentMode === 'template'

export const canSubmit = (
  action: ActionMode,
  values: EmailFormValues,
  options: { contentMode: ContentMode; templateError: string | null; templateLoading: boolean },
) => {
  if (action === 'verify') return true

  const hasRecipient = values.to.trim().length > 0
  const hasSubject = values.subject.trim().length > 0
  const hasBody = values.text.trim().length > 0 || values.html.trim().length > 0
  if (!hasRecipient || !hasSubject || !hasBody) return false

  if (!showsTemplatePreview(action, options.contentMode)) return true
  return !options.templateLoading && !options.templateError
}

export const buildRequestBody = (action: ActionMode, values: EmailFormValues) => {
  const body: Record<string, unknown> = { action }

  if (values.impl) body.impl = values.impl

  if (action === 'sendMail') {
    body.payload = {
      ...(values.from.trim() ? { from: values.from.trim() } : {}),
      ...(values.html.trim() ? { html: values.html.trim() } : {}),
      ...(values.replyTo.trim() ? { replyTo: values.replyTo.trim() } : {}),
      ...(values.text.trim() ? { text: values.text.trim() } : {}),
      subject: values.subject.trim(),
      to: values.to.trim(),
    }
  }

  return body
}

export const getEmailResultSummary = (verifyResult: VerifyResult | null, messageId?: string) => {
  if (verifyResult) return verifyResult.valid ? 'valid' : 'invalid'
  return messageId
}

export const buildResultSummary = ({
  action,
  payloadAction,
  provider,
  runState,
  sendMailResult,
  verifyResult,
}: {
  action: ActionMode
  payloadAction?: ActionMode
  provider: string
  runState: RunState | null
  sendMailResult: SendMailResult | null
  verifyResult: VerifyResult | null
}): SummaryItem[] => [
  { label: 'Action', value: payloadAction ?? action },
  { label: 'Provider', value: provider },
  { label: '结果', value: getEmailResultSummary(verifyResult, sendMailResult?.messageId) ?? 'N/A' },
  { label: 'HTTP 耗时', value: runState ? `${runState.durationMs.toLocaleString()} ms` : 'N/A' },
]
