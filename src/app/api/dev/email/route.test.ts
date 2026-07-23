// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EmailImplType, EmailService } from '@/server/services/email'

import { GET, POST } from './route'

vi.mock('@/libs/better-auth/email-templates/preview', () => ({
  parseEmailTemplateKey: (value: unknown) => {
    const keys = ['verification', 'change-email', 'magic-link', 'reset-password', 'verification-otp']

    return typeof value === 'string' && keys.includes(value) ? value : undefined
  },
  parseEmailTemplateParams: (value: unknown) => {
    if (value === undefined) {
      return undefined
    }

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return undefined
    }

    return value
  },
  renderEmailTemplate: vi.fn((key: string, params?: { url?: string }) => ({
    html: `<p>Rendered ${key} ${params?.url ?? 'https://localhost:3000/auth/verify?token=preview-token'}</p>`,
    subject: key === 'verification' ? '验证您的邮箱 - PureChat' : 'Subject',
    text: `Text for ${key} ${params?.url ?? 'https://localhost:3000/auth/verify?token=preview-token'}`,
  })),
}))

vi.mock('@/server/services/email', () => ({
  EmailImplType: {
    Nodemailer: 'nodemailer',
    Resend: 'resend',
  },
  EmailService: vi.fn(),
}))

const postJson = (body: unknown) => {
  return POST(
    new Request('http://localhost/api/dev/email', {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
  )
}

describe('/api/dev/email', () => {
  const mockVerify = vi.fn()
  const mockSendMail = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerify.mockResolvedValue(true)
    mockSendMail.mockResolvedValue({
      messageId: 'test-message-id',
      previewUrl: 'https://ethereal.email/message/xxx',
    })
    vi.mocked(EmailService).mockImplementation(
      () =>
        ({
          sendMail: mockSendMail,
          verify: mockVerify,
        }) as unknown as EmailService
    )
  })

  it('returns available actions from GET', async () => {
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.actions).toEqual(['verify', 'sendMail', 'renderTemplate'])
    expect(payload.impls).toEqual(['nodemailer', 'resend'])
  })

  it('dispatches verify action to EmailService.verify', async () => {
    const response = await postJson({ action: 'verify' })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(EmailService).toHaveBeenCalledWith(undefined)
    expect(mockVerify).toHaveBeenCalled()
    expect(payload).toEqual({ action: 'verify', result: { valid: true }, success: true })
  })

  it('dispatches verify action with impl override', async () => {
    const response = await postJson({ action: 'verify', impl: 'resend' })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(EmailService).toHaveBeenCalledWith(EmailImplType.Resend)
    expect(payload).toEqual({ action: 'verify', result: { valid: true }, success: true })
  })

  it('dispatches sendMail action to EmailService.sendMail', async () => {
    const response = await postJson({
      action: 'sendMail',
      impl: 'nodemailer',
      payload: {
        from: 'sender@example.com',
        html: '<p>Hello</p>',
        subject: 'Test Email',
        text: 'Hello',
        to: 'recipient@example.com',
      },
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(EmailService).toHaveBeenCalledWith(EmailImplType.Nodemailer)
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'sender@example.com',
      html: '<p>Hello</p>',
      subject: 'Test Email',
      text: 'Hello',
      to: 'recipient@example.com',
    })
    expect(payload).toEqual({
      action: 'sendMail',
      result: {
        messageId: 'test-message-id',
        previewUrl: 'https://ethereal.email/message/xxx',
      },
      success: true,
    })
  })

  it('supports multiple recipients in sendMail payload', async () => {
    const response = await postJson({
      action: 'sendMail',
      payload: {
        subject: 'Team update',
        text: 'Hello team',
        to: ['user1@example.com', 'user2@example.com'],
      },
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockSendMail).toHaveBeenCalledWith({
      subject: 'Team update',
      text: 'Hello team',
      to: ['user1@example.com', 'user2@example.com'],
    })
    expect(payload.success).toBe(true)
  })

  it('returns 400 for invalid action', async () => {
    const response = await postJson({ action: 'missing' })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error).toContain('Invalid action')
  })

  it('returns 400 for invalid impl', async () => {
    const response = await postJson({ action: 'verify', impl: 'sendgrid' })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      error: 'Invalid impl. Available impls: nodemailer, resend',
      success: false,
    })
  })

  it('returns 400 for missing payload.to', async () => {
    const response = await postJson({
      action: 'sendMail',
      payload: {
        subject: 'Test',
        text: 'Hello',
      },
    })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      error: 'Missing or invalid "payload.to" field',
      success: false,
    })
  })

  it('returns 400 for missing payload.subject', async () => {
    const response = await postJson({
      action: 'sendMail',
      payload: {
        text: 'Hello',
        to: 'recipient@example.com',
      },
    })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      error: 'Missing or invalid "payload.subject" field',
      success: false,
    })
  })

  it('returns 400 when sendMail payload has no text or html', async () => {
    const response = await postJson({
      action: 'sendMail',
      payload: {
        subject: 'Test',
        to: 'recipient@example.com',
      },
    })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      error: 'Missing email content. Provide "payload.text" or "payload.html"',
      success: false,
    })
  })

  it('returns 400 for invalid JSON', async () => {
    const response = await POST(
      new Request('http://localhost/api/dev/email', {
        body: '{',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ error: 'Invalid JSON body', success: false })
  })

  it('returns 500 when verify throws', async () => {
    mockVerify.mockRejectedValue(new Error('SMTP verification failed'))

    const response = await postJson({ action: 'verify' })
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({ error: 'SMTP verification failed', success: false })
  })

  it('returns 500 when sendMail throws', async () => {
    mockSendMail.mockRejectedValue(new Error('provider down'))

    const response = await postJson({
      action: 'sendMail',
      payload: {
        subject: 'Test',
        text: 'Hello',
        to: 'recipient@example.com',
      },
    })
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({ error: 'provider down', success: false })
  })

  it('renders email template with renderTemplate action', async () => {
    const response = await postJson({
      action: 'renderTemplate',
      params: {
        expiresInSeconds: 3600,
        otp: '654321',
        url: 'https://example.com/verify?token=abc',
        userName: 'Test User',
      },
      template: 'verification',
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(EmailService).not.toHaveBeenCalled()
    expect(payload.success).toBe(true)
    expect(payload.action).toBe('renderTemplate')
    expect(payload.result).toMatchObject({
      html: expect.stringContaining('https://example.com/verify?token=abc'),
      subject: '验证您的邮箱 - PureChat',
      text: expect.stringContaining('https://example.com/verify?token=abc'),
    })
  })

  it('renders email template with default params when params omitted', async () => {
    const response = await postJson({
      action: 'renderTemplate',
      template: 'reset-password',
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.result.html).toContain('preview-token')
  })

  it('returns 400 for invalid template in renderTemplate', async () => {
    const response = await postJson({
      action: 'renderTemplate',
      params: {},
      template: 'unknown-template',
    })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      error: 'Missing or invalid "template" field',
      success: false,
    })
  })

  it('returns 400 for invalid params in renderTemplate', async () => {
    const response = await postJson({
      action: 'renderTemplate',
      params: 'invalid',
      template: 'verification',
    })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      error: 'Missing or invalid "params" field',
      success: false,
    })
  })
})
