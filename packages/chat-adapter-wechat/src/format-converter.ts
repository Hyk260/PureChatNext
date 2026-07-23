import { BaseFormatConverter, parseMarkdown, stringifyMarkdown, type Root } from 'chat'

/** Markdown ↔ plain text for WeChat iLink (no Markdown rendering on the client). */
export class WechatFormatConverter extends BaseFormatConverter {
  /** mdast → WeChat-safe text (stringify; client shows plain text). */
  fromAst(ast: Root): string {
    return stringifyMarkdown(ast)
  }

  /** Inbound WeChat text → mdast. */
  toAst(text: string): Root {
    return parseMarkdown(text.trim())
  }
}
