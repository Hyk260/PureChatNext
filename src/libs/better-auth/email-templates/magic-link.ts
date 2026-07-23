/**
 * Magic link sign-in email template
 * Sent when user requests passwordless login
 */
import { formatExpirationText } from './utils/format-expiration-text'
import { loadTemplateHtml } from './utils/load-template-html'
import { renderHtmlTemplate } from './utils/render-html-template'

const TEMPLATE = loadTemplateHtml('magic-link.html')

export const getMagicLinkEmailTemplate = (params: { expiresInSeconds: number; url: string }) => {
  const { url, expiresInSeconds } = params

  const expirationText = formatExpirationText(expiresInSeconds)

  return {
    html: renderHtmlTemplate(TEMPLATE, {
      expirationText,
      url,
      year: String(new Date().getFullYear()),
    }),
    subject: '您的 PureChat 登录链接',
    text: `请使用以下链接登录：${url}\n\n此链接将在 ${expirationText} 后过期。`,
  }
}
