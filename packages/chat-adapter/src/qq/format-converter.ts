import { BaseFormatConverter, parseMarkdown, stringifyMarkdown } from 'chat'
import type { Root } from 'chat'

/** Markdown ↔ text for QQ Bot messages (@pure/chat-adapter/qq). */
export class QQFormatConverter extends BaseFormatConverter {
  /** mdast → outbound text (QQ has limited Markdown; stringify for now). */
  fromAst(ast: Root): string {
    return stringifyMarkdown(ast)
  }

  /** Inbound QQ text → mdast (strip @mention / channel markers first). */
  toAst(text: string): Root {
    const cleaned = text
      .replaceAll(/<@!?\d+>/g, '')
      .replaceAll('<@everyone>', '')
      .replaceAll(/<#\d+>/g, '')
      .trim()

    return parseMarkdown(cleaned)
  }

  /** Strip QQ @mention / channel markers from plain text. */
  cleanMentions(text: string): string {
    return text
      .replaceAll(/<@!?\d+>/g, '')
      .replaceAll('<@everyone>', '')
      .replaceAll(/<#\d+>/g, '')
      .trim()
  }
}
