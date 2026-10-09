import { loadTemplateHtml } from './utils/load-template-html'
import { renderHtmlTemplate } from './utils/render-html-template'

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]!
  )

export function getReferralEmailTemplate({ url, userName }: { url: string; userName?: string | null }) {
  const name = userName || '一位好友'
  const parsedUrl = new URL(url)
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('邀请链接必须使用 HTTP(S)')
  return {
    subject: '你已受邀使用 PureChat',
    html: renderHtmlTemplate(loadTemplateHtml('referral.html'), { url: escapeHtml(url), userName: escapeHtml(name) }),
    text: `${name} 邀请你使用 PureChat。\n与好友一起体验 AI 对话、搜索和创作。\n\n接受邀请：${url}\n\n此邀请仅面向新用户，请使用收件邮箱注册并完成邮箱验证。链接将在 7 天后过期。\n如果你不认识邀请人，可以忽略这封邮件。`,
  }
}
