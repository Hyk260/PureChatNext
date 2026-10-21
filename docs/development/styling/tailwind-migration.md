---
title: Tailwind 样式迁移
description: 将 PureChatNext 页面样式逐步迁移到 Tailwind，并按 Lobe UI 公开 API 定制组件。
---

# Tailwind 样式迁移

业务 UI 使用 Tailwind CSS 4 与 `@lobehub/ui`。迁移存量样式时保持页面结构和交互不变，按功能域渐进处理，不为提高迁移比例而重写复杂 CSS。

## 新代码约定

- 通用交互组件优先直接从 `@lobehub/ui` 导入；`@pure/ui` 保留项目定制组件与能力。
- 布局、间距、尺寸和简单状态优先用 Tailwind；格式化后的静态 `className` 不超过 120 字符。
- 先复用 `src/styles/utilities.css` 中稳定的布局组合。确有复杂选择器、动画、SVG、滚动条或动态几何值时，使用 `createStaticStyles`。
- 组件样式优先用公开 `classNames` / `styles` 语义槽位；依赖稳定类名时使用 Lobe UI 的 `lobe-*` 类，不使用组件库内部 DOM 猜测样式。
- 颜色从 Lobe UI 主题 token 或 `src/styles/globals.css` 中已有的语义 token 选择，不自行拼接 CSS 变量。

## 主题边界

[`src/layout/ThemeProviders.tsx`](../../../src/layout/ThemeProviders.tsx) 是唯一应用主题入口，负责 Lobe UI 中文资源、浅色/深色/系统外观、自定义主色、持久化，以及 `ModalHost` 和 `ToastHost`。主题和 Provider 行为变更前，先阅读 [Lobe UI 组件规范](./lobe-ui-guidelines.md)，不要新增平行 Provider 或样式桥接。

## 迁移步骤

1. 阅读 [Lobe UI llms.txt](https://ui.lobehub.com/llms.txt) 和 [skills.md](https://ui.lobehub.com/skills.md)，再查看对应组件文档，并核对安装版本的本地类型声明。
2. 找出当前样式承载方式、组件公开槽位与主题变量。先用 Tailwind 表达普通布局，不在同一任务中机械重写整文件。
3. 复杂样式保留 `createStaticStyles`；简单静态样式只有在变更范围相关时才顺手迁移。
4. 清除被替换组件遗留的 `.ant-*` 选择器、动态前缀、旧注释、Provider 规则和测试 mock。
5. 用相关组件测试、窄屏与明暗主题检查新行为；运行与修改范围相称的 lint、类型检查和构建。

## 复杂样式的保留条件

以下样式可继续使用从 `@lobehub/ui` 导出的 `createStaticStyles`：

- 多层后代选择器、复杂伪类或多个交互状态。
- 动画、SVG 属性、滚动条、运行时尺寸和其他动态几何值。
- 组件库公开稳定类名不足以覆盖、且无法通过语义槽位表达的局部定制。
- Tailwind 组合合理复用后仍超过项目的 class 长度限制。

在代码附近说明保留原因。跨页面复用的稳定布局组合可以加入 `utilities.css`；不要为单个组件新增全局 utility。

## 验收

- 业务布局使用 Tailwind，复杂样式有明确保留理由。
- 主题 token 只由应用主题入口与 Lobe UI 提供，不添加第二套颜色变量映射。
- 没有旧 antd Provider、`.ant-*` 样式或仅服务于已迁移组件的测试 mock。
- 暗色、浅色、自定义主色、移动布局和键盘交互保持正确。
- 通过 `pnpm exec eslint <changed-files>`、`pnpm exec tsc --noEmit` 和相关测试。
