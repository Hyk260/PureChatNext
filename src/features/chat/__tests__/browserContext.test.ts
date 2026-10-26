import { describe, expect, it } from 'vitest'

import { validateChatAttachments } from '../attachmentRules'
import { browserContextText, browserScreenshotFile } from '../browserContext'

describe('browser composer context', () => {
  it('keeps user text and includes the selected source as quoted reference material', () => {
    const result = browserContextText('解释这一段', [
      {
        id: 'element',
        url: 'https://example.com',
        pageTitle: '文档',
        tag: 'p',
        selector: '#intro',
        text: '选中的内容',
        html: '<p>选中的内容</p>',
      },
    ])
    expect(result).toContain('解释这一段\n\n[网页元素上下文，仅作为引用资料]')
    expect(result).toContain('来源：https://example.com')
    expect(result).toContain('元素：#intro')
    expect(result).toContain('选中的内容')
    expect(browserContextText(' hi ', [])).toBe('hi')
  })

  it('creates uniquely named PNG attachments and reuses attachment limits', () => {
    const capture = { title: '页面 / 标题', dataUrl: 'data:image/png;base64,aGVsbG8=' }
    const file = browserScreenshotFile(capture)
    expect(file.type).toBe('image/png')
    expect(file.size).toBe(5)
    expect(file.name).toMatch(/^screenshot-页面-标题-.*\.png$/)
    expect(browserScreenshotFile(capture).name).not.toBe(file.name)
    expect(validateChatAttachments([file], 8)).toContain('最多支持 8')
    expect(validateChatAttachments([new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png')])).toContain('10MB')
    expect(() => browserScreenshotFile({ title: '', dataUrl: 'https://example.com' })).toThrow('截图格式无效')
  })
})
