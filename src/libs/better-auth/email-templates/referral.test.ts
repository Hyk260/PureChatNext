import { describe, expect, it } from 'vitest'

import { renderEmailTemplate } from './preview/preview'
import { EMAIL_TEMPLATE_CATALOG } from './preview/preview-catalog'
import { getReferralEmailTemplate } from './referral'

const url = 'https://purechat.cn/accept-referral?referral_context=test&x=1'

describe('PureChat invitation email', () => {
  it('renders escaped HTML and matching text, with a usable fallback link', () => {
    const result = getReferralEmailTemplate({ url, userName: '<script>alert("x")</script>' })
    expect(result.subject).toBe('你已受邀使用 PureChat')
    expect(result.html).toContain('&lt;script&gt;')
    expect(result.html).not.toContain('<script>')
    expect(result.html).toContain('referral_context=test&amp;x=1')
    expect(result.html).toContain('7 天')
    expect(result.text).toContain(url)
    expect(result.text).toContain('完成邮箱验证')
    expect(result.html).not.toContain('ChatGPT')
  })
  it('rejects unsafe schemes and supports the existing preview catalog', () => {
    expect(() => getReferralEmailTemplate({ url: 'javascript:alert(1)' })).toThrow()
    expect(EMAIL_TEMPLATE_CATALOG.find((item) => item.key === 'referral')).toBeTruthy()
    expect(renderEmailTemplate('referral', { url, userName: '好友' }).html).toContain('好友')
  })
})
