# PureChatNext 样式与 AI 编码规范

本文是 PureChatNext 的样式单一约定，适用于人工开发与 AI coding agent。目标是让业务层逐步采用 Tailwind CSS，同时把 `createStaticStyles` 限制在真正需要复杂 CSS 的场景，不要求为了迁移而进行一次性重写。

## 一句话规则

新组件默认使用 Tailwind CSS；简单的几行 CSS 不再创建 `createStaticStyles`；样式量大、状态复杂、包含动画或需要动态计算时，可以继续使用 `createStaticStyles`。

## 选择方式

| 场景 | 首选 | 说明 |
| --- | --- | --- |
| 新组件的布局、间距、尺寸、颜色、边框、圆角 | Tailwind class | 直接写在 JSX 的 `className` 中 |
| 简单静态样式，通常只有少量声明 | Tailwind class | 不要为了几行 CSS 创建 `styles` 对象 |
| 多状态组合、复杂伪类、响应式或 container query | Tailwind 或 `createStaticStyles` | 以可读性和维护成本为准 |
| 动画、keyframes、SVG 图形、滚动条、动态几何尺寸 | `createStaticStyles` | 允许保留，避免把动态值硬塞进 className |
| `@pure/ui` / antd 组件内部 DOM 的定制 | 组件 API、token、`classNames` / `styles` | 不依赖不稳定的内部类名 |
| 主题变量 | 语义化 Tailwind token | 不要在业务 JSX 中散落硬编码颜色 |

样式数量只是辅助判断，不是硬性阈值。即使只有两三行，如果包含动态计算值，也可以保留 `createStaticStyles`；反过来，十几行简单的 Tailwind class 如果仍然清晰，也不必抽成 CSS。

## 新组件规范

### 默认写法

新组件应优先这样组织：

```tsx
export const EmptyState = ({ title }: { title: string }) => (
  <section className='flex flex-col items-center gap-2 px-6 py-8 text-center'>
    <h2 className='text-base font-medium text-[var(--pure-vars-colorText)]'>{title}</h2>
    <p className='text-sm text-[var(--pure-vars-colorTextSecondary)]'>暂无内容</p>
  </section>
)
```

允许使用已有的 `@pure/ui` 组件；Tailwind 负责业务布局和外观，组件自身的交互和可访问性仍由 UI 组件负责。

### 不要这样写

不要为少量静态声明创建新的 `createStaticStyles`：

```tsx
const styles = createStaticStyles(({ css }) => ({
  hint: css`
    font-size: 12px;
    text-align: center;
  `,
}))
```

应直接使用：

```tsx
<p className='text-center text-xs'>...</p>
```

也不要为了“迁移到 Tailwind”把复杂的动态 CSS 拆成难以阅读的超长 className。

## 主题与颜色

- 业务组件优先使用主题语义：文字、次级文字、容器背景、边框、主色、错误色等。
- Tailwind 的主题变量应映射到运行时主题变量；迁移时不要直接复制 dev 页面中的 `slate-*`、`cyan-*` 等展示色作为主应用 token。
- 当前主题由 `@pure/ui/ThemeProvider` 与 `antd-style` 共同提供。除非 `@pure/ui` 的主题桥接也已替换，否则不要移除 `StyleProvider` 或假设 Tailwind 能独立提供全部主题能力。
- 可使用 Tailwind arbitrary value 过渡，例如 `text-[var(--pure-vars-colorTextSecondary)]`；重复使用的 token 应在 `src/styles/globals.css` 或 `src/styles/utilities.css` 中统一命名。
- 不要把一次性 inline `style` 当成 Tailwind 的替代品。动态尺寸、动画延迟、滚动位置等运行时值仍可使用 `style`。

## 什么时候保留 `createStaticStyles`

以下情况可以保留：

- 样式包含多个交互状态，并且需要组合伪类、属性选择器或后代选择器。
- 需要 `@media`、`@container`、复杂的响应式布局，且 className 已明显影响可读性。
- 包含 keyframes、SVG animation、滤镜或复杂 transition。
- 样式依赖运行时计算的 CSS 值，尤其是滚动条 thumb、拖拽位置、几何尺寸。
- `@pure/ui` 桥接组件需要稳定的组件级样式，迁移会改变公共组件行为或造成明显回归风险。

保留时应在代码附近说明原因，避免后续误判为普通样式。例如：

```tsx
// 保留 createStaticStyles：thumb 尺寸由运行时滚动计算，且包含轴向状态与拖拽状态。
const styles = createStaticStyles(...)
```

## AI 编码要求

AI 创建或修改 React 组件时必须遵循：

1. 先判断任务是新组件、简单样式修改，还是复杂/动态样式维护。
2. 新组件和简单样式默认使用 Tailwind，不新增 `createStaticStyles`。
3. 只有确有复杂性时才使用 `createStaticStyles`，并在交付说明中指出保留原因。
4. 优先复用现有主题变量与 `@pure/ui`，不要引入新的 CSS-in-JS 库或新的样式方案。
5. 不进行与任务无关的全量样式重构，不把 `@pure/ui` 内部实现迁移混入业务组件修改。
6. 完成后检查是否新增了不必要的 `createStaticStyles`，并运行针对性的 lint/typecheck。

## 现有代码迁移原则

- 迁移范围以业务层为主，不把 LobeHub / `@pure/ui` 的内部样式作为第一阶段目标。
- 每次按页面或功能域迁移，保持小 diff，并在迁移后进行页面级视觉检查。
- 先迁移布局、间距、颜色和简单状态，再处理复杂交互样式。
- 迁移后若 className 变得比原实现更难读，应退回 `createStaticStyles` 或拆分组件，而不是追求形式上的 Tailwind 化。
- 删除 `createStaticStyles` 后，必须确认对应的 `antd-style` import、测试 mock 和无用样式变量也一并清理。

## 相关文件

- [Tailwind 样式迁移方案](./tailwind-style-migration-guide.zh-CN.md)
- [全局 Tailwind 入口](../src/styles/globals.css)
- [语义化 Tailwind utilities](../src/styles/utilities.css)
- [主题 Provider](../src/layout/ThemeProviders.tsx)
- [UI 包主题桥接](../packages/ui/src/ThemeProvider/index.ts)
