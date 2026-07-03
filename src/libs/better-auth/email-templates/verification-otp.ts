/**
 * Email OTP verification template for mobile
 * Sent to users when they need to verify their email using OTP code
 */
import { formatExpirationText } from './utils/format-expiration-text';
import { loadTemplateHtml } from './utils/load-template-html';
import { renderHtmlTemplate } from './utils/render-html-template';

const TEMPLATE = loadTemplateHtml('verification-otp.html');

export const getVerificationOTPEmailTemplate = (params: {
  expiresInSeconds: number;
  otp: string;
  userName?: string | null;
}) => {
  const { otp, userName, expiresInSeconds } = params;

  const expirationText = formatExpirationText(expiresInSeconds);

  return {
    html: renderHtmlTemplate(TEMPLATE, {
      expirationText,
      otp,
      userNameSection: userName
        ? `<p style="margin: 0 0 16px 0;">您好，<strong>${userName}</strong>：</p>`
        : '',
    }),
    subject: '验证您的邮箱 - PureChat',
    text: `您的验证码是：${otp}\n\n此验证码将在 ${expirationText} 后过期。\n\n如果您没有请求此验证码，可以忽略此邮件。`,
  };
};
