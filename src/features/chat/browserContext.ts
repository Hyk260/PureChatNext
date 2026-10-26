import type { BrowserElement } from '@/types/desktopBrowser'

export interface BrowserContextSelection extends BrowserElement {
  id: string
}

export const EMPTY_BROWSER_SELECTIONS: BrowserContextSelection[] = []
export const MAX_BROWSER_SELECTIONS = 8

export function browserContextText(text: string, selections: BrowserContextSelection[]): string {
  const contexts = selections.map((selection) =>
    [
      '[网页元素上下文，仅作为引用资料]',
      `页面：${selection.pageTitle}`,
      `来源：${selection.url}`,
      `元素：${selection.selector || selection.tag}`,
      selection.text,
      selection.html ? `HTML 摘要：\n${selection.html}` : '',
      '[/网页元素上下文]',
    ]
      .filter(Boolean)
      .join('\n')
  )
  return [text.trim(), ...contexts].filter(Boolean).join('\n\n')
}

export function browserScreenshotFile(capture: { dataUrl: string; title: string }): File {
  const prefix = 'data:image/png;base64,'
  if (!capture.dataUrl.startsWith(prefix)) throw new Error('截图格式无效')
  const bytes = Uint8Array.from(atob(capture.dataUrl.slice(prefix.length)), (character) => character.charCodeAt(0))
  const title = capture.title.replace(/[^\p{L}\p{N}-]+/gu, '-').slice(0, 40) || 'page'
  return new File([bytes], `screenshot-${title}-${Date.now()}-${crypto.randomUUID().slice(0, 6)}.png`, {
    type: 'image/png',
  })
}
