/**
 * Email verification template
 * Sent to users when they sign up to verify their email address
 */
import { formatExpirationText } from './utils/format-expiration-text'
import { loadTemplateHtml } from './utils/load-template-html'
import { renderHtmlTemplate } from './utils/render-html-template'

const TEMPLATE = loadTemplateHtml('verification.html')

export const getVerificationEmailTemplate = (params: {
  expiresInSeconds: number
  url: string
  userName?: string | null
}) => {
  const { url, userName, expiresInSeconds } = params

  const expirationText = formatExpirationText(expiresInSeconds)

  return {
    html: renderHtmlTemplate(TEMPLATE, {
      expirationText,
      url,
      userNameSection: userName ? `<p style="margin: 0 0 16px 0;">您好，<strong>${userName}</strong>：</p>` : '',
    }),
    subject: '验证您的邮箱 - PureChat',
    text: `请点击以下链接验证您的邮箱：${url}\n\n此链接将在 ${expirationText} 后过期。`,
  }
}
