import { describe, expect, it } from 'vitest'

import {
  EXAMPLE_SEND_MAIL,
  buildRequestBody,
  canSubmit,
  getEmailResultSummary,
  initialForm,
  providerLabel,
} from './emailServiceModel'
import type { EmailFormValues } from './emailServiceModel'

const form = (patch: Partial<EmailFormValues> = {}): EmailFormValues => ({ ...initialForm(), ...patch })

const submitOpts = (patch: { contentMode?: 'custom' | 'template'; templateError?: string | null; templateLoading?: boolean } = {}) => ({
  contentMode: patch.contentMode ?? ('custom' as const),
  templateError: patch.templateError ?? null,
  templateLoading: patch.templateLoading ?? false,
})

describe('canSubmit', () => {
  it('always allows verify', () => {
    expect(canSubmit('verify', form({ to: '', subject: '' }), submitOpts())).toBe(true)
  })

  it('requires to, subject, and body for sendMail', () => {
    expect(canSubmit('sendMail', form({ to: '' }), submitOpts())).toBe(false)
    expect(canSubmit('sendMail', form({ subject: '' }), submitOpts())).toBe(false)
    expect(canSubmit('sendMail', form({ html: '', text: '' }), submitOpts())).toBe(false)
    expect(canSubmit('sendMail', form(), submitOpts())).toBe(true)
  })

  it('blocks template mode while loading or errored', () => {
    expect(canSubmit('sendMail', form(), submitOpts({ contentMode: 'template', templateLoading: true }))).toBe(false)
    expect(canSubmit('sendMail', form(), submitOpts({ contentMode: 'template', templateError: 'boom' }))).toBe(false)
    expect(canSubmit('sendMail', form(), submitOpts({ contentMode: 'template' }))).toBe(true)
  })
})

describe('buildRequestBody', () => {
  it('omits empty impl and optional payload fields on sendMail', () => {
    expect(buildRequestBody('sendMail', form({ from: '  ', replyTo: '' }))).toEqual({
      action: 'sendMail',
      payload: {
        html: EXAMPLE_SEND_MAIL.html,
        subject: EXAMPLE_SEND_MAIL.subject,
        text: EXAMPLE_SEND_MAIL.text,
        to: EXAMPLE_SEND_MAIL.to,
      },
    })
  })

  it('includes impl and optional fields when set', () => {
    expect(
      buildRequestBody(
        'sendMail',
        form({ from: ' a@b.com ', html: '', impl: 'resend', replyTo: ' r@b.com ', text: ' hi ' }),
      ),
    ).toEqual({
      action: 'sendMail',
      impl: 'resend',
      payload: {
        from: 'a@b.com',
        replyTo: 'r@b.com',
        subject: EXAMPLE_SEND_MAIL.subject,
        text: 'hi',
        to: EXAMPLE_SEND_MAIL.to,
      },
    })
  })

  it('builds a verify body with optional impl only', () => {
    expect(buildRequestBody('verify', form())).toEqual({ action: 'verify' })
    expect(buildRequestBody('verify', form({ impl: 'nodemailer' }))).toEqual({
      action: 'verify',
      impl: 'nodemailer',
    })
  })
})

describe('helpers', () => {
  it('summarizes verify and sendMail results', () => {
    expect(getEmailResultSummary({ valid: true })).toBe('valid')
    expect(getEmailResultSummary({ valid: false })).toBe('invalid')
    expect(getEmailResultSummary(null, 'msg-1')).toBe('msg-1')
    expect(getEmailResultSummary(null)).toBeUndefined()
  })

  it('resolves provider labels', () => {
    expect(providerLabel('')).toBe('Env 默认 · default')
    expect(providerLabel('resend')).toBe('Resend')
  })
})
