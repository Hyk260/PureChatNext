/**
 * Expose the shared theme system (motion/appearance) through the application UI package.
 * antd ConfigProvider does not support the `motion` prop, so keep this adapter.
 * Call sites should import from `@pure/ui/ThemeProvider`; swap for a local implementation later.
 *
 * 与其它 UI 适配组件保持相同的根入口导入。若 Provider 走组件库深路径，
 * 而 Accordion 等组件走组件库根入口，Vite 可能生成两份模块实例，
 * 导致它们各自拥有独立的 MotionComponent Context，组件就会误报缺少 Provider。
 */
export { ConfigProvider, ThemeProvider } from '@lobehub/ui'
