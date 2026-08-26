/**
 * Expose the shared HtmlPreview through the application UI package.
 * Call sites should import from `@pure/ui`; swap for a local implementation later.
 */
export { default as HtmlPreview } from '@lobehub/ui/es/HtmlPreview/index'
export type { HtmlPreviewProps } from '@lobehub/ui/es/HtmlPreview/type'
