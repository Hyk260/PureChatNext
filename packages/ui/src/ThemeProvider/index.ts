/**
 * Bridge over `@lobehub/ui` theme system (motion/appearance).
 * antd ConfigProvider does not support `motion` prop, so keep lobehub bridge.
 * Call sites should import from `@pure/ui/ThemeProvider`; swap for a local implementation later.
 *
 * 与其它 UI 桥接组件保持相同的根入口导入。若 Provider 走 `@lobehub/ui/es/...`
 * 深路径，而 Accordion 等组件走 `@lobehub/ui` 根入口，Vite 可能生成两份模块实例，
 * 导致它们各自拥有独立的 MotionComponent Context，组件就会误报缺少 Provider。
 */
export { ConfigProvider, ThemeProvider } from '@lobehub/ui'
