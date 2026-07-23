/**
 * Change email verification template
 * Sent to users when they request to change their email address
 */
import { formatExpirationText } from './utils/format-expiration-text'
import { loadTemplateHtml } from './utils/load-template-html'
import { renderHtmlTemplate } from './utils/render-html-template'

const TEMPLATE = loadTemplateHtml('change-email.html')

export const getChangeEmailVerificationTemplate = (params: {
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
    subject: '确认您的新邮箱 - PureChat',
    text: `您请求更改 PureChat 账户邮箱。请点击以下链接确认：${url}\n\n此链接将在 ${expirationText} 后过期。\n\n如果您没有请求此更改，可以忽略此邮件。`,
  }
}
