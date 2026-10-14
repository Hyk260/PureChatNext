import { isRecord } from '@pure/utils/object'
import { localStg } from '@pure/utils/storage'

import {
  getEmailTemplatePreviewParams,
  parseEmailTemplateKey,
  parseEmailTemplateParams,
} from '@/libs/better-auth/email-templates/preview'
import type { EmailTemplateKey, EmailTemplateParams, RenderedEmailTemplate } from '@/libs/better-auth/email-templates/preview'

import { initialForm } from './emailServiceModel'
import type {
  ActionMode,
  ApiSuccess,
  ContentMode,
  EmailFormValues,
  ResultView,
  RightPanelView,
  RunState,
} from './emailServiceModel'

export const EMAIL_SERVICE_CACHE_KEY = 'purechat:admin:email-service:v1'

export type EmailServiceCache = {
  action: ActionMode
  contentMode: ContentMode
  error: string | null
  payload: ApiSuccess | null
  renderedTemplate: RenderedEmailTemplate | null
  rightPanel: RightPanelView
  runState: RunState | null
  templateLabel: string
  templateParams: EmailTemplateParams
  templateKey: EmailTemplateKey
  values: EmailFormValues
  view: ResultView
}

const isActionMode = (value: unknown): value is ActionMode => value === 'sendMail' || value === 'verify'
const isContentMode = (value: unknown): value is ContentMode => value === 'custom' || value === 'template'
const isRightPanelView = (value: unknown): value is RightPanelView => value === 'preview' || value === 'response'
const isResultView = (value: unknown): value is ResultView => value === 'summary' || value === 'json'
const isProviderOption = (value: unknown): value is EmailFormValues['impl'] =>
  value === '' || value === 'nodemailer' || value === 'resend'

const parseValues = (value: unknown): EmailFormValues => {
  const defaults = initialForm()
  if (!isRecord(value)) return defaults

  const stringValue = (key: keyof EmailFormValues) =>
    typeof value[key] === 'string' ? (value[key] as string) : defaults[key]

  return {
    from: stringValue('from'),
    html: stringValue('html'),
    impl: isProviderOption(value.impl) ? value.impl : defaults.impl,
    replyTo: stringValue('replyTo'),
    subject: stringValue('subject'),
    text: stringValue('text'),
    to: stringValue('to'),
  }
}

const parseRunState = (value: unknown): RunState | null => {
  if (
    !isRecord(value) ||
    typeof value.durationMs !== 'number' ||
    typeof value.status !== 'number' ||
    typeof value.submittedAt !== 'string'
  ) {
    return null
  }

  return { durationMs: value.durationMs, status: value.status, submittedAt: value.submittedAt }
}

const parsePayload = (value: unknown): ApiSuccess | null => {
  if (!isRecord(value) || value.success !== true || !isActionMode(value.action) || !isRecord(value.result)) return null
  if (value.action === 'verify' && typeof value.result.valid === 'boolean') {
    return value as ApiSuccess
  }
  if (value.action === 'sendMail' && typeof value.result.messageId === 'string') {
    return value as ApiSuccess
  }
  return null
}

const parseRenderedTemplate = (value: unknown): RenderedEmailTemplate | null => {
  if (
    !isRecord(value) ||
    typeof value.html !== 'string' ||
    typeof value.subject !== 'string' ||
    typeof value.text !== 'string'
  ) {
    return null
  }
  return { html: value.html, subject: value.subject, text: value.text }
}

export const readEmailServiceCache = (): EmailServiceCache | null => {
  const value = localStg.getJson(EMAIL_SERVICE_CACHE_KEY)
  if (!isRecord(value)) return null

  const templateKey = parseEmailTemplateKey(value.templateKey) ?? 'verification'
  return {
    action: isActionMode(value.action) ? value.action : 'sendMail',
    contentMode: isContentMode(value.contentMode) ? value.contentMode : 'custom',
    error: typeof value.error === 'string' ? value.error : null,
    payload: parsePayload(value.payload),
    renderedTemplate: parseRenderedTemplate(value.renderedTemplate),
    rightPanel: isRightPanelView(value.rightPanel) ? value.rightPanel : 'preview',
    runState: parseRunState(value.runState),
    templateLabel: typeof value.templateLabel === 'string' ? value.templateLabel : '注册验证',
    templateKey,
    templateParams: parseEmailTemplateParams(value.templateParams) ?? getEmailTemplatePreviewParams(templateKey),
    values: parseValues(value.values),
    view: isResultView(value.view) ? value.view : 'summary',
  }
}

export const writeEmailServiceCache = (cache: EmailServiceCache): void => {
  try {
    localStg.setJson(EMAIL_SERVICE_CACHE_KEY, cache)
  } catch {
    // Storage may be unavailable in private browsing or when the browser quota is exhausted.
  }
}

export const clearEmailServiceCache = (): void => {
  localStg.remove(EMAIL_SERVICE_CACHE_KEY)
}
