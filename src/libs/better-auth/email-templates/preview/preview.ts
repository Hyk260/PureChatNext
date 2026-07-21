import { getChangeEmailVerificationTemplate } from '../change-email';
import { getMagicLinkEmailTemplate } from '../magic-link';
import { getResetPasswordEmailTemplate } from '../reset-password';
import { getVerificationEmailTemplate } from '../verification';
import { getVerificationOTPEmailTemplate } from '../verification-otp';

import {
  EMAIL_TEMPLATE_CATALOG,
  EMAIL_TEMPLATE_PREVIEW_MOCK,
  type EmailTemplateKey,
  type EmailTemplateParams,
  type EmailTemplatePreview,
  type RenderedEmailTemplate,
} from './preview-catalog';

const resolveTemplateParams = (params: EmailTemplateParams = {}) => {
  const { url, userName, expiresInSeconds, otp } = {
    ...EMAIL_TEMPLATE_PREVIEW_MOCK,
    ...params,
  };

  return { expiresInSeconds, otp, url, userName };
};

export function renderEmailTemplate(
  key: EmailTemplateKey,
  params: EmailTemplateParams = {},
): RenderedEmailTemplate {
  const { url, userName, expiresInSeconds, otp } = resolveTemplateParams(params);

  switch (key) {
    case 'verification':
      return getVerificationEmailTemplate({ expiresInSeconds, url, userName });
    case 'change-email':
      return getChangeEmailVerificationTemplate({ expiresInSeconds, url, userName });
    case 'magic-link':
      return getMagicLinkEmailTemplate({ expiresInSeconds, url });
    case 'reset-password':
      return getResetPasswordEmailTemplate({ url });
    case 'verification-otp':
      return getVerificationOTPEmailTemplate({ expiresInSeconds, otp, userName });
    default:
      throw new Error(`Unknown email template: ${key}`);
  }
}

export function getEmailTemplatePreviews(): EmailTemplatePreview[] {
  return EMAIL_TEMPLATE_CATALOG.map(entry => ({
    key: entry.key,
    label: entry.label,
    ...renderEmailTemplate(entry.key),
  }));
}
