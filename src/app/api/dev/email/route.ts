import { NextResponse } from 'next/server'

import { isRecord, toTrimmedString } from '@pure/utils/object'
import {
  parseEmailTemplateKey,
  parseEmailTemplateParams,
  renderEmailTemplate,
} from '@/libs/better-auth/email-templates/preview'
import { EmailImplType, EmailService } from '@/server/services/email'
import type { EmailPayload } from '@/server/services/email/impls'
import { devActionSuccess, devError, getErrorMessage } from '../_utils'

type EmailAction = 'verify' | 'sendMail' | 'renderTemplate'

const availableActions: EmailAction[] = ['verify', 'sendMail', 'renderTemplate']
const availableImpls = Object.values(EmailImplType)

const parseRecipients = (value: unknown): string[] | undefined => {
  if (typeof value === 'string') {
    const recipients = value
      .split(/[\n,，]/)
      .map((item) => item.trim())
      .filter(Boolean)

    return recipients.length > 0 ? recipients : undefined
  }

  if (Array.isArray(value)) {
    const recipients = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)

    return recipients.length > 0 ? recipients : undefined
  }

  return undefined
}

const resolveImplType = (value: unknown): EmailImplType | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string' || !availableImpls.includes(value as EmailImplType)) {
    return undefined
  }

  return value as EmailImplType
}

const parseSendMailPayload = (rawPayload: unknown): EmailPayload | undefined => {
  if (!isRecord(rawPayload)) {
    return undefined
  }

  const to = parseRecipients(rawPayload.to)
  const subject = toTrimmedString(rawPayload.subject)
  const text = toTrimmedString(rawPayload.text)
  const html = toTrimmedString(rawPayload.html)

  if (!to || !subject) {
    return undefined
  }

  if (!text && !html) {
    return undefined
  }

  const from = toTrimmedString(rawPayload.from)
  const replyTo = toTrimmedString(rawPayload.replyTo)

  return {
    ...(from ? { from } : {}),
    ...(html ? { html } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(text ? { text } : {}),
    subject,
    to: to.length === 1 ? to[0]! : to,
  }
}

/**
 * 邮件服务测试 API（仅开发环境）
 * POST /api/dev/email
 */
export const POST = async (req: Request) => {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return devError('Invalid JSON body')
  }

  if (!isRecord(body)) {
    return devError('Request body must be an object')
  }

  const rawAction = body.action

  if (typeof rawAction !== 'string' || !availableActions.includes(rawAction as EmailAction)) {
    return devError(`Invalid action. Available actions: ${availableActions.join(', ')}`)
  }

  const action = rawAction as EmailAction

  if (body.impl !== undefined && resolveImplType(body.impl) === undefined) {
    return devError(`Invalid impl. Available impls: ${availableImpls.join(', ')}`)
  }

  if (action === 'renderTemplate') {
    const template = parseEmailTemplateKey(body.template)

    if (!template) {
      return devError('Missing or invalid "template" field')
    }

    if (body.params !== undefined && parseEmailTemplateParams(body.params) === undefined) {
      return devError('Missing or invalid "params" field')
    }

    const params = parseEmailTemplateParams(body.params) ?? {}

    try {
      const result = renderEmailTemplate(template, params)

        return devActionSuccess(action, result)
    } catch (error) {
      const message = getErrorMessage(error)

      return devError(message, 500)
    }
  }

  const implType = resolveImplType(body.impl)

  try {
    const emailService = new EmailService(implType)

    if (action === 'verify') {
      const valid = await emailService.verify()

      return devActionSuccess(action, { valid })
    }

    const rawPayload = body.payload

    if (!isRecord(rawPayload)) {
      return devError('Missing or invalid "payload" field')
    }

    const to = parseRecipients(rawPayload.to)
    const subject = toTrimmedString(rawPayload.subject)
    const text = toTrimmedString(rawPayload.text)
    const html = toTrimmedString(rawPayload.html)

    if (!to) {
      return devError('Missing or invalid "payload.to" field')
    }

    if (!subject) {
      return devError('Missing or invalid "payload.subject" field')
    }

    if (!text && !html) {
      return devError('Missing email content. Provide "payload.text" or "payload.html"')
    }

    const payload = parseSendMailPayload(rawPayload)

    if (!payload) {
      return devError('Invalid sendMail payload')
    }

    const result = await emailService.sendMail(payload)

    return devActionSuccess(action, result)
  } catch (error) {
    const message = getErrorMessage(error)

    return devError(message, 500)
  }
}

/**
 * 邮件服务测试 API（仅开发环境）
 * GET /api/dev/email
 */
export const GET = async () => {
  return NextResponse.json(
    {
      actions: availableActions,
      impls: availableImpls,
      message: 'Email API',
    },
    { status: 200 }
  )
}
