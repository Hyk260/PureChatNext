/**
 * Password reset email template
 * Sent to users when they request a password reset
 */
import { loadTemplateHtml } from './utils/load-template-html';
import { renderHtmlTemplate } from './utils/render-html-template';

const TEMPLATE = loadTemplateHtml('reset-password.html');

export const getResetPasswordEmailTemplate = (params: { url: string }) => {
  const { url } = params;

  return {
    html: renderHtmlTemplate(TEMPLATE, {
      url,
      year: String(new Date().getFullYear()),
    }),
    subject: '重置您的密码 - PureChat',
    text: `请点击以下链接重置密码：${url}`,
  };
};
