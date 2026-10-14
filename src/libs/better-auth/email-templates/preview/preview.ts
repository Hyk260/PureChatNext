import { getReferralEmailTemplate } from '../referral'
import { getChangeEmailVerificationTemplate } from '../change-email'
import { getMagicLinkEmailTemplate } from '../magic-link'
import { getResetPasswordEmailTemplate } from '../reset-password'
import { getVerificationEmailTemplate } from '../verification'
import { getVerificationOTPEmailTemplate } from '../verification-otp'

import { getEmailTemplatePreviewParams } from './preview-catalog'
import type { EmailTemplateKey, EmailTemplateParams, RenderedEmailTemplate } from './preview-catalog'

const resolveTemplateParams = (key: EmailTemplateKey, params: EmailTemplateParams = {}) => {
  const { url, userName, expiresInSeconds, otp } = {
    ...getEmailTemplatePreviewParams(key),
    ...params,
  }

  return { expiresInSeconds, otp, url, userName }
}

export function renderEmailTemplate(key: EmailTemplateKey, params: EmailTemplateParams = {}): RenderedEmailTemplate {
  const { url, userName, expiresInSeconds, otp } = resolveTemplateParams(key, params)

  switch (key) {
    case 'referral':
      return getReferralEmailTemplate({ url, userName })
    case 'verification':
      return getVerificationEmailTemplate({ expiresInSeconds, url, userName })
    case 'change-email':
      return getChangeEmailVerificationTemplate({ expiresInSeconds, url, userName })
    case 'magic-link':
      return getMagicLinkEmailTemplate({ expiresInSeconds, url })
    case 'reset-password':
      return getResetPasswordEmailTemplate({ url })
    case 'verification-otp':
      return getVerificationOTPEmailTemplate({ expiresInSeconds, otp, userName })
    default:
      throw new Error(`Unknown email template: ${key}`)
  }
}
