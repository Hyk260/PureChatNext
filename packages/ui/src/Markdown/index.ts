/**
 * Expose the shared content renderers through the application UI package.
 * Call sites should import from `@pure/ui/Markdown`; swap for a local implementation later.
 */
export { default as FileTypeIcon } from '@lobehub/ui/es/FileTypeIcon/index'
export { default as Highlighter } from '@lobehub/ui/es/Highlighter/index'
export { default as Markdown } from '@lobehub/ui/es/Markdown/index'
export type { MarkdownProps } from '@lobehub/ui/es/Markdown/type'
