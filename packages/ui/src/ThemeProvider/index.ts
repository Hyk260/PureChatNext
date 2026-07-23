/**
 * Bridge over `@lobehub/ui` theme system (motion/appearance).
 * antd ConfigProvider does not support `motion` prop, so keep lobehub bridge.
 * Call sites should import from `@pure/ui`; swap for a local implementation later.
 */
export { ConfigProvider, ThemeProvider } from '@lobehub/ui'
