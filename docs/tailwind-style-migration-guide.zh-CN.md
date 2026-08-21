# PureChatNext 样式迁移方案

## 目标

逐步将业务层从 LobeHub 风格的 `createStaticStyles` 迁移到 Tailwind CSS，同时保留复杂 CSS 的表达能力，避免视觉回归和一次性大规模重构。

迁移完成后的边界：

- 新业务组件默认使用 Tailwind。
- 简单静态样式不再新增 `createStaticStyles`。
- 复杂、动态、动画和基础 UI 样式允许继续使用 `createStaticStyles`。
- `@pure/ui` 的主题和组件桥接在业务迁移稳定后再单独评估。

## 当前基线

当前仓库已经在 [`src/styles/globals.css`](../src/styles/globals.css) 接入 Tailwind v4，并通过 [`postcss.config.mjs`](../postcss.config.mjs) 构建。

迁移前的代码扫描基线：

- 约 92 个生产代码文件使用 `createStaticStyles`。
- 约 87 个生产代码文件直接使用 `cssVar`。
- 主要分布在 chat、settings、home、resources、community。
- Tailwind class 已在 dev 页面、认证页和少量基础组件中使用。

这些数字用于衡量进度，不应作为一次性迁移清单。每次迁移后可用以下命令重新统计：

```bash
rg -l "createStaticStyles" src packages --glob '*.{ts,tsx}' --glob '!**/*.test.*' | wc -l
rg -l "cssVar" src packages --glob '*.{ts,tsx}' --glob '!**/*.test.*' | wc -l
```

## 阶段 0：先统一 token 和边界

在迁移业务页面前完成：

1. 确认 `ThemeProvider` 产生的运行时 CSS 变量命名和暗色模式行为。
2. 在 `src/styles/globals.css` 的 `@theme inline` 中建立语义化 Tailwind token，或在 `src/styles/utilities.css` 中建立少量稳定的语义 utility。
3. 明确文字、背景、边框、主色、成功、警告、错误、阴影和圆角的映射。
4. 约定业务组件不得直接复制 dev 页面中的展示色作为主应用主题。
5. 保留 `antd-style` 和 `StyleProvider`，因为 `@pure/ui` 仍依赖它们。

推荐的 token 方向：

```css
@theme inline {
  --color-app-text: var(--pure-vars-colorText);
  --color-app-text-secondary: var(--pure-vars-colorTextSecondary);
  --color-app-surface: var(--pure-vars-colorBgContainer);
  --color-app-border: var(--pure-vars-colorBorderSecondary);
}
```

变量名以浏览器中实际生成的 `pure-vars` 为准；如果当前主题系统生成的名称不同，应先修正映射，不要在组件中散落多个写法。

## 阶段 1：新代码设闸

从规则生效开始：

- 新组件默认写 Tailwind class。
- 少量样式修改不创建 `styles` 常量。
- `createStaticStyles` 只有在复杂性可说明时才允许新增。
- 新增例外时，在代码附近写一句保留原因。
- `@pure/ui` 组件继续使用，但业务布局优先用 `className` 或已有 props 组合。

这一步不要求立即减少存量，只防止迁移过程中继续增加债务。

## 阶段 2：试点迁移

优先选择简单、边界清晰、视觉影响可控的文件，例如：

- `src/features/settings/provider/styles.ts`
- settings 中的 row、label、hint、shell
- 简单的 card、empty state、页面容器
- 只包含布局、间距、颜色、border、radius 的 `createStaticStyles`

每个试点按以下顺序完成：

1. 把 `styles.xxx` 用 Tailwind class 替换。
2. 将 `cssVar` 使用转为统一的语义 token。
3. 删除无用的 `antd-style` import、`styles` 常量和测试 mock。
4. 检查响应式、暗色模式和交互状态。
5. 运行 lint/typecheck，并进行页面视觉检查。

## 阶段 3：按功能域迁移

建议顺序：

1. settings：结构清晰，适合作为主要试点。
2. community：卡片、列表和分类组件可批量验证。
3. home：布局较多，迁移时注意侧边栏折叠和响应式行为。
4. resources：包含滚动和动态尺寸，简单外层先迁移，复杂内部保留。
5. chat：最后迁移，避免影响输入框、消息流和模型切换等高频交互。

每个功能域完成后，记录：

- 剩余 `createStaticStyles` 文件数。
- 保留的复杂样式及原因。
- 是否存在主题或视觉回归。
- 是否需要补充语义 token 或 utility。

## 阶段 4：复杂样式分类处理

以下代码不应为了追求 Tailwind 覆盖率强行改写：

- [`src/components/Scrollbar/index.tsx`](../src/components/Scrollbar/index.tsx)：运行时滚动尺寸、横纵轴状态和拖拽状态。
- [`src/components/NeuralNetworkLoading/index.tsx`](../src/components/NeuralNetworkLoading/index.tsx)：SVG 属性、动画和动态延迟。
- 包含多个 `@media` / `@container` / 属性选择器 / 后代选择器的组件。
- 依赖动态 CSS 值、计算尺寸或复杂 transition 的组件。
- `packages/ui` 中仍作为公共桥接层的基础组件。

这些样式可以继续使用 `createStaticStyles`。如果未来需要进一步去除 CSS-in-JS，应先建立独立的基础组件样式方案，再单独迁移，而不是在业务迁移中顺带处理。

## 阶段 5：收尾与清理

只有在业务层迁移稳定后再做：

- 删除不再使用的 `createStaticStyles` import。
- 删除测试中仅用于这些模块的 `antd-style` mock。
- 合并重复的 Tailwind utility 和语义 token。
- 评估是否还有必要在业务层直接使用 `cssVar`。
- 单独评估 `@pure/ui` 是否需要从 LobeHub 样式桥接迁移。

不要因为业务层已大量使用 Tailwind，就直接删除 `antd-style`、`StyleProvider` 或 `ThemeProvider`。

## 验收标准

每个迁移 PR 至少满足：

- 新增组件没有无必要的 `createStaticStyles`。
- Tailwind class 使用语义化 token，不新增无理由的硬编码主题色。
- 桌面、窄屏、暗色模式和主要交互状态保持一致。
- `pnpm exec eslint <changed-files>` 通过。
- `pnpm exec tsc --noEmit` 通过。
- 复杂样式保留时有明确原因，不以“全部 Tailwind 化”为验收指标。

## 不建议的做法

- 用全局搜索替换一次性迁移全部 `styles.xxx`。
- 把每个 CSS 属性机械转换成 class，导致 className 无法阅读。
- 在组件中直接写一套与 `antd-style` 不一致的暗色 token。
- 为了迁移简单样式而引入新的 `clsx`、CSS-in-JS 或样式框架。
- 把 `@pure/ui` 内部实现与业务迁移放在同一个大 PR 中。
- 把动态运行时值伪装成静态 Tailwind class。

## 迁移完成定义

迁移不是要求仓库中完全没有 `createStaticStyles`，而是满足：

- 新代码全部遵循 Tailwind 优先。
- 存量 `createStaticStyles` 都有复杂性或公共组件边界上的合理原因。
- 主题 token 只有一个可维护来源。
- 业务层不再依赖 LobeHub 风格的样式组织方式来完成普通布局。
