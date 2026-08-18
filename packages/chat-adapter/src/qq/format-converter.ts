import { BaseFormatConverter, parseMarkdown, stringifyMarkdown } from 'chat'
import type { Root } from 'chat'

/** `@pure/chat-adapter/qq` 的 QQ Bot 消息 Markdown ↔ 纯文本转换器。 */
export class QQFormatConverter extends BaseFormatConverter {
  /** 将 mdast 转为出站文本；QQ Markdown 能力有限，目前统一序列化为文本。 */
  fromAst(ast: Root): string {
    return stringifyMarkdown(ast)
  }

  /** 将入站 QQ 文本转为 mdast，并先移除 @提及和频道标记。 */
  toAst(text: string): Root {
    const cleaned = text
      .replaceAll(/<@!?\d+>/g, '')
      .replaceAll('<@everyone>', '')
      .replaceAll(/<#\d+>/g, '')
      .trim()

    return parseMarkdown(cleaned)
  }

  /** 从纯文本中移除 QQ 的 @提及和频道标记。 */
  cleanMentions(text: string): string {
    return text
      .replaceAll(/<@!?\d+>/g, '')
      .replaceAll('<@everyone>', '')
      .replaceAll(/<#\d+>/g, '')
      .trim()
  }
}
