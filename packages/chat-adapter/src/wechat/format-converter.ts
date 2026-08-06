import { BaseFormatConverter, parseMarkdown, stringifyMarkdown } from 'chat'
import type { Root } from 'chat'

/** 微信 iLink 的 Markdown ↔ 纯文本（客户端不渲染 Markdown）。 */
export class WechatFormatConverter extends BaseFormatConverter {
  /** mdast → 微信安全文本（stringify；客户端显示纯文本）。 */
  fromAst(ast: Root): string {
    return stringifyMarkdown(ast)
  }

  /** 入站微信文本 → mdast。 */
  toAst(text: string): Root {
    return parseMarkdown(text.trim())
  }
}
