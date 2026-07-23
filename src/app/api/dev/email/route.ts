import { NextResponse } from 'next/server'

import {
  parseEmailTemplateKey,
  parseEmailTemplateParams,
  renderEmailTemplate,
} from '@/libs/better-auth/email-templates/preview'
import { EmailImplType, EmailService } from '@/server/services/email'
import { type EmailPayload } from '@/server/services/email/impls'

type EmailAction = 'verify' | 'sendMail' | 'renderTemplate'

const availableActions: EmailAction[] = ['verify', 'sendMail', 'renderTemplate']
const availableImpls = Object.values(EmailImplType)

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const stringOrUndefined = (value: unknown) => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

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

const badRequest = (error: string) => {
  return NextResponse.json({ error, success: false }, { status: 400 })
}

const success = (action: EmailAction, result: unknown) => {
  return NextResponse.json({ action, result, success: true }, { status: 200 })
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }

  return 'Internal server error'
}

const parseSendMailPayload = (rawPayload: unknown): EmailPayload | undefined => {
  if (!isRecord(rawPayload)) {
    return undefined
  }

  const to = parseRecipients(rawPayload.to)
  const subject = stringOrUndefined(rawPayload.subject)
  const text = stringOrUndefined(rawPayload.text)
  const html = stringOrUndefined(rawPayload.html)

  if (!to || !subject) {
    return undefined
  }

  if (!text && !html) {
    return undefined
  }

  const from = stringOrUndefined(rawPayload.from)
  const replyTo = stringOrUndefined(rawPayload.replyTo)

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
    return badRequest('Invalid JSON body')
  }

  if (!isRecord(body)) {
    return badRequest('Request body must be an object')
  }

  const rawAction = body.action

  if (typeof rawAction !== 'string' || !availableActions.includes(rawAction as EmailAction)) {
    return badRequest(`Invalid action. Available actions: ${availableActions.join(', ')}`)
  }

  const action = rawAction as EmailAction

  if (body.impl !== undefined && resolveImplType(body.impl) === undefined) {
    return badRequest(`Invalid impl. Available impls: ${availableImpls.join(', ')}`)
  }

  if (action === 'renderTemplate') {
    const template = parseEmailTemplateKey(body.template)

    if (!template) {
      return badRequest('Missing or invalid "template" field')
    }

    if (body.params !== undefined && parseEmailTemplateParams(body.params) === undefined) {
      return badRequest('Missing or invalid "params" field')
    }

    const params = parseEmailTemplateParams(body.params) ?? {}

    try {
      const result = renderEmailTemplate(template, params)

      return success(action, result)
    } catch (error) {
      const message = getErrorMessage(error)

      return NextResponse.json({ error: message, success: false }, { status: 500 })
    }
  }

  const implType = resolveImplType(body.impl)

  try {
    const emailService = new EmailService(implType)

    if (action === 'verify') {
      const valid = await emailService.verify()

      return success(action, { valid })
    }

    const rawPayload = body.payload

    if (!isRecord(rawPayload)) {
      return badRequest('Missing or invalid "payload" field')
    }

    const to = parseRecipients(rawPayload.to)
    const subject = stringOrUndefined(rawPayload.subject)
    const text = stringOrUndefined(rawPayload.text)
    const html = stringOrUndefined(rawPayload.html)

    if (!to) {
      return badRequest('Missing or invalid "payload.to" field')
    }

    if (!subject) {
      return badRequest('Missing or invalid "payload.subject" field')
    }

    if (!text && !html) {
      return badRequest('Missing email content. Provide "payload.text" or "payload.html"')
    }

    const payload = parseSendMailPayload(rawPayload)

    if (!payload) {
      return badRequest('Invalid sendMail payload')
    }

    const result = await emailService.sendMail(payload)

    return success(action, result)
  } catch (error) {
    const message = getErrorMessage(error)

    return NextResponse.json({ error: message, success: false }, { status: 500 })
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
