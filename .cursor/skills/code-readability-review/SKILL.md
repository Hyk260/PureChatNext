---
name: code-readability-review
description: >-
  Reviews and optionally refactors TypeScript/React code for readability:
  nested ternaries, enum-to-label maps, early returns, oversized JSX expressions,
  and conditional className composition (cn/cx/template literals). Use when the
  user mentions ugly/nested ternaries, messy className branches, unreadable JSX
  conditionals, code style review for readability, 不优雅, 嵌套三元, or asks to
  clean up similar structures.
---

# 可读性代码风格审查

把「能跑但不优雅」的分支结构改成一眼能扫读的代码。默认只报告；用户确认后再改。

改写示例与 before/after 见 [references/patterns.md](references/patterns.md)。遇到嵌套三元、条件 className、多分支 placeholder/label 时先读该文件。

## 工作流

1. **审查（默认）**：扫描目标文件/选区，按下方规则出 findings。**不改文件**。
2. **等确认**：用户说「改吧」「按建议改」等明确同意后，再进入重构。
3. **重构**：按 findings 最小 diff 落地；只动可读性，不顺手改行为、不引入新依赖。
4. **收尾**：简述改了哪些点；若某处刻意保留（如单层三元更清晰），说明原因。

## 本仓库惯例

- **正例**：`src/features/dev/WechatConversationPage.tsx` 中 `statusChip` 用 `Record` 做状态→样式/文案映射——同类映射优先对齐这种写法。
- **`cx`**：antd-style / CSS modules 文件沿用已有 `cx`，扁平布尔组合（`cx(base, cond && variant)`）。
- **Tailwind 模板字符串**：优先映射表或小 helper；不要为了「用上 cn」新建工具函数。仅当文件/包已有 `cn` / `clsx` / `cx` 时推荐用它们组合 className。

## 规则优先级

### P0 — 必查

| 模式 | 判定 | 首选改写 |
|------|------|----------|
| 嵌套三元（≥2 层 `? :`） | 文案、枚举、状态映射 | `Record` / lookup + fallback |
| 多分支 UI 文案 | placeholder、label、权限文案 | 小函数 + early return，或 lookup |
| 条件 className 嵌套三元 | 多状态 × active 等 | `getXxxClass(...)`、二维 lookup；已有 `cx`/`cn` 则扁平布尔 |

### P1 — 建议查

| 模式 | 首选改写 |
|------|----------|
| 过长内联 JSX 表达式 | 提取命名变量 / 子组件 / helper |
| 深层逻辑塞在 JSX 属性里 | 渲染前算好再传入 |
| 可 early return 仍用大 if/else 或三元 | 扁平守卫 return |
| `&&` 与三元混用难扫读 | 统一成一种清晰结构 |

### 明确不做

- 纯偏好（引号风格、无关命名争论）
- 与业务无关的大重构
- 为用上 `cn` 而新增尚未存在的工具函数

## 审查输出模板

```markdown
## 可读性审查

### 摘要
- N 处建议处理（P0: x / P1: y）

### Findings
1. **[P0] 嵌套三元 → 映射表** — `path:line`
   - 现状：简述
   - 建议：给出 5–15 行目标代码片段
2. ...

### 下一步
确认后我可以按上述建议直接改文件（最小 diff）。
```

## 重构约束

- 保持行为不变（文案、样式、条件语义一致）。
- 优先复用文件内已有模式（如已有 `Record` map，新映射用同结构）。
- 单层、两侧都很短的三元可以保留（如 `active ? 'a' : 'b'`）。
- 提取的 helper 放在同文件合适位置；仅当多处复用且适合共享时再上提。
