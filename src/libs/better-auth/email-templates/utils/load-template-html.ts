import changeEmailHtml from '../html/change-email.html';
import magicLinkHtml from '../html/magic-link.html';
import resetPasswordHtml from '../html/reset-password.html';
import verificationOtpHtml from '../html/verification-otp.html';
import verificationHtml from '../html/verification.html';

const TEMPLATES: Record<string, string> = {
  'change-email.html': changeEmailHtml,
  'magic-link.html': magicLinkHtml,
  'reset-password.html': resetPasswordHtml,
  'verification-otp.html': verificationOtpHtml,
  'verification.html': verificationHtml,
};

export function loadTemplateHtml(name: string): string {
  const template = TEMPLATES[name];
  if (!template) {
    throw new Error(`Unknown email template: ${name}`);
  }

  return template;
}
