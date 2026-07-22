import { BaseFormatConverter, parseMarkdown, stringifyMarkdown, type Root } from 'chat';

export class WechatFormatConverter extends BaseFormatConverter {
  /**
   * Convert mdast AST to WeChat-compatible text.
   * WeChat does not support Markdown; convert to plain text.
   */
  fromAst(ast: Root): string {
    return stringifyMarkdown(ast);
  }

  /**
   * Convert WeChat message text to mdast AST.
   */
  toAst(text: string): Root {
    return parseMarkdown(text.trim());
  }
}
