/**
 * Bridge over `@lobehub/ui` theme system (motion/appearance).
 * antd ConfigProvider does not support `motion` prop, so keep lobehub bridge.
 * Call sites should import from `@pure/ui/ThemeProvider`; swap for a local implementation later.
 *
 * 深路径导入（`@lobehub/ui/es/...`）而非根 barrel `@lobehub/ui`。
 * 根 barrel 顶部 eager 导入全部组件（含 Highlighter / Markdown / shiki / mermaid），
 * 且 sideEffects 标记 CSS 文件为有副作用，使 rolldown 无法摇掉未使用的重导出 ——
 * 会导致 eager 链路（ThemeProviders）把 shiki / mermaid / katex 拖入主入口 chunk。
 * 深路径仅拉取 ConfigProvider / ThemeProvider 自身依赖（antd / antd-style / styles/theme），不含 Markdown。
 *
 * 上游类型缺陷：`@lobehub/ui` 深路径运行时为 default 导出，
 * 但其 .d.mts 仅声明 named 导出（无 default），故下方两行需 @ts-expect-error。
 * 上游修复后可移除。
 */
// @ts-expect-error @lobehub/ui deep path ships default export at runtime but omits it in .d.mts
export { default as ConfigProvider } from '@lobehub/ui/es/ConfigProvider/index'
// @ts-expect-error @lobehub/ui deep path ships default export at runtime but omits it in .d.mts
export { default as ThemeProvider } from '@lobehub/ui/es/ThemeProvider/ThemeProvider'
