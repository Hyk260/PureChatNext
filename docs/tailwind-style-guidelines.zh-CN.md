# PureChatNext 样式与 AI 编码规范

本文是 PureChatNext 的样式单一约定，适用于人工开发与 AI coding agent。目标是让业务层逐步采用 Tailwind CSS，同时保持 JSX 可读，并把复杂、动态或过长的样式留给 `createStaticStyles`。不要求为了迁移而进行一次性重写。

## 一句话规则

新组件默认使用 Tailwind CSS；格式化后单个静态 `className` 不得超过 120 字符。先复用 Tailwind 内置工具和 `utilities.css` 组合，仍然超限时必须改用 `createStaticStyles`。

## 选择方式

| 场景 | 首选 | 说明 |
| --- | --- | --- |
| 新组件的布局、间距、尺寸、颜色、边框、圆角 | Tailwind class | 直接写在 JSX 的 `className` 中 |
| 简单静态样式，通常只有少量声明 | Tailwind class | 不要为了几行 CSS 创建 `styles` 对象 |
| 格式化后静态 `className` 超过 120 字符 | `utilities.css` 或 `createStaticStyles` | 先复用稳定组合；仍超限则必须使用 `createStaticStyles` |
| 多状态组合、复杂伪类、响应式或 container query | Tailwind 或 `createStaticStyles` | 以可读性和维护成本为准 |
| 动画、keyframes、SVG 图形、滚动条、动态几何尺寸 | `createStaticStyles` | 允许保留，避免把动态值硬塞进 className |
| `@pure/ui` / antd 组件内部 DOM 的定制 | 组件 API、token、`classNames` / `styles` | 不依赖不稳定的内部类名 |
| 主题变量 | 语义化 Tailwind token | 不要在业务 JSX 中散落硬编码颜色 |

120 字符是硬限制，不以声明数量替代。即使只有两三项样式，只要包含动态计算值或复杂状态，也可以保留 `createStaticStyles`；即使全是简单样式，只要静态 `className` 在格式化后仍超过 120 字符，也必须迁移。

## 新组件规范

### 默认写法

新组件应优先这样组织：

```tsx
export const EmptyState = ({ title }: { title: string }) => (
  <section className='flex flex-col items-center gap-2 px-6 py-8 text-center'>
    <h2 className='text-base font-medium text-foreground'>{title}</h2>
    <p className='text-sm text-muted-foreground'>暂无内容</p>
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

## 120 字符硬限制

以 Prettier 的 `printWidth: 120` 和格式化后的源码为准：

1. 单个静态 `className` 字符串不超过 120 字符时，可以直接使用 Tailwind。
2. 超过 120 字符时，先使用 Tailwind 内置缩写（如 `size-*`、`inset-*`、`truncate`）和现有 `utilities.css` 组合。
3. 只有跨组件重复且语义稳定的组合才允许新增 `@utility`；不得为单个组件创建专属全局类。
4. 复用后仍超过 120 字符时，将该元素的组件级样式迁移到 `createStaticStyles`。
5. 禁止通过字符串拼接、数组、模板拆行或无意义的 `cx()` 参数拆分绕过限制。条件样式可以使用 `cx()`，但每个静态类字符串仍受 120 字符限制。

## 公共组合工具类

跨页面反复出现的静态组合可以收敛到 [`src/styles/utilities.css`](../src/styles/utilities.css)，使用 Tailwind v4 的 `@utility` 定义。新增前必须先搜索仓库，并同时满足：

- 至少在多个页面或功能域重复出现，而不是只服务于单个组件。
- 组合语义稳定，通常由三个及以上基础工具类构成，并能明显缩短 `className`。
- 使用完整、可理解的名称，例如 `flex-center`、`flex-between`、`flex-between-wrap`；不要维护 `flex-bc` 这类需要查表的字母缩写矩阵。
- 只封装稳定的布局或浏览器兼容行为。`gap`、`padding`、颜色、断点和 `max-width` 等页面设计决策通常保留在调用处。
- 优先使用 Tailwind 已有工具，例如 `size-full`、`truncate`、`grid`；不要创建重复别名。
- 按 Flex、定位、文本/滚动等类别集中维护注释，并同步迁移至少一个实际调用点，避免积累未使用的工具类。
- 不把 `utilities.css` 当作规避 120 字符限制的组件私有样式表；不满足复用条件时直接使用 `createStaticStyles`。

例如：

```tsx
<div className='flex-between-wrap w-full max-w-[720px] gap-6'>...</div>
```

`@pure/ui` 的 `Flexbox` 是例外：其 `flex`、`width`、`height`、`padding` 等属性由 `--lobe-flex-*` CSS 变量控制。不要依赖普通 Tailwind 工具类覆盖这些属性；应使用 `Flexbox` 自身 props，或者由原生 HTML 元素承担 Tailwind 布局。

## 主题与颜色

- 业务组件优先使用主题语义：文字、次级文字、容器背景、边框、主色、错误色等。
- Tailwind 只能使用 [`src/styles/globals.css`](../src/styles/globals.css) 中已经定义的语义 token；迁移时不要直接复制 dev 页面中的 `slate-*`、`cyan-*` 等展示色作为主应用 token。
- 当前主题由 `@pure/ui/ThemeProvider` 与 `antd-style` 共同提供。除非 `@pure/ui` 的主题桥接也已替换，否则不要移除 `StyleProvider` 或假设 Tailwind 能独立提供全部主题能力。
- `theme={{ cssVar: { key: 'pure-vars' } }}` 中的 `pure-vars` 是 CSS 变量作用域 key，不是变量名前缀。不得根据 key 猜测或拼接变量名。
- `antd-style` 的 `cssVar` 当前对应 kebab-case 的 `--ant-*` 变量，例如 `cssVar.colorTextSecondary` 是 `var(--ant-color-text-secondary)`，`cssVar.colorError` 是 `var(--ant-color-error)`。
- 组件需要尚未映射为 Tailwind 语义 token 的 antd 主题色时，优先在 `createStaticStyles` 中使用 `cssVar`。只有确认真实运行时变量并在浅色、深色主题下验证后，才可在 `globals.css` 的 `@theme inline` 中新增全局语义映射。
- 不要把一次性 inline `style` 当成 Tailwind 的替代品。动态尺寸、动画延迟、滚动位置等运行时值仍可使用 `style`。

## 什么时候保留 `createStaticStyles`

以下情况可以保留：

- 样式包含多个交互状态，并且需要组合伪类、属性选择器或后代选择器。
- 需要 `@media`、`@container`、复杂的响应式布局，且 className 已明显影响可读性。
- 包含 keyframes、SVG animation、滤镜或复杂 transition。
- 样式依赖运行时计算的 CSS 值，尤其是滚动条 thumb、拖拽位置、几何尺寸。
- `@pure/ui` 桥接组件需要稳定的组件级样式，迁移会改变公共组件行为或造成明显回归风险。
- 格式化后静态 `className` 经合理复用仍超过 120 字符。

保留时应在代码附近说明原因，避免后续误判为普通样式。例如：

```tsx
// 保留 createStaticStyles：thumb 尺寸由运行时滚动计算，且包含轴向状态与拖拽状态。
const styles = createStaticStyles(...)
```

## AI 编码要求

AI 创建或修改 React 组件时必须遵循：

1. 先判断任务是新组件、简单样式修改，还是复杂/动态样式维护。
2. 新组件和简单样式默认使用 Tailwind，但必须遵守静态 `className` 120 字符限制。
3. 超限时先复用内置工具和 `utilities.css`；仍超限或样式确有复杂性时使用 `createStaticStyles`，并在代码附近说明原因。
4. 优先复用现有主题变量与 `@pure/ui`，不要引入新的 CSS-in-JS 库或新的样式方案。
5. 不进行与任务无关的全量样式重构，不把 `@pure/ui` 内部实现迁移混入业务组件修改。
6. 完成后检查是否新增了不必要的 `createStaticStyles`，并运行针对性的 lint/typecheck。
7. 添加组合工具类前先验证仓库复用频率；禁止为单页尺寸、一次性视觉参数或规避行宽创建全局 shortcut。

## 现有代码迁移原则

- 迁移范围以业务层为主，不把 LobeHub / `@pure/ui` 的内部样式作为第一阶段目标。
- 每次按页面或功能域迁移，保持小 diff，并在迁移后进行页面级视觉检查。
- 先迁移布局、间距、颜色和简单状态，再处理复杂交互样式。
- 迁移后若 className 变得比原实现更难读，应退回 `createStaticStyles` 或拆分组件，而不是追求形式上的 Tailwind 化。
- 迁移后若静态 `className` 超过 120 字符，应先复用已有 utility，仍超限则退回 `createStaticStyles`，不得机械拆分字符串。
- 删除 `createStaticStyles` 后，必须确认对应的 `antd-style` import、测试 mock 和无用样式变量也一并清理。

## 相关文件

- [Tailwind 样式迁移方案](./tailwind-style-migration-guide.zh-CN.md)
- [全局 Tailwind 入口](../src/styles/globals.css)
- [语义化 Tailwind utilities](../src/styles/utilities.css)
- [主题 Provider](../src/layout/ThemeProviders.tsx)
- [UI 包主题桥接](../packages/ui/src/ThemeProvider/index.ts)
