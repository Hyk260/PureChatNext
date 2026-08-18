---
name: api-route-readability
description: >-
  Reviews and optionally refactors Next.js App Router handlers under src/app/api
  for human-scannable style: nested ternaries in status/guards, early returns,
  named booleans, and JSDoc on routes. Use when the user mentions API 接口格式,
  route 可读性, nested ternaries in route.ts, src/app/api, 嵌套三元, or asks to
  clean up API handler formatting without changing behavior.
---

# API 路由可读性审查

把 `src/app/api/**/route.ts` 里「能跑但难扫读」的分支改成一眼能跟的 handler。默认只报告；用户确认后再改。

UI / JSX / className 走 [code-readability-review](../code-readability-review/SKILL.md)。本 skill 只覆盖 API handler。

改写示例与 before/after 见 [references/patterns.md](references/patterns.md)。遇到嵌套三元、有序守卫、枚举→文案时先读该文件。

## 工作流

1. **审查（默认）**：扫描目标文件/选区，按下方规则出 findings。**不改文件**。
2. **等确认**：用户说「改吧」「按建议改」等明确同意后，再进入重构。
3. **重构**：按 findings 最小 diff 落地；只动书写风格，不改行为。
4. **收尾**：简述改了哪些点；若某处刻意保留（如单层短三元），说明原因。

## 本仓库惯例

规范来自现有 `src/app/api/` 写法，不发明新架构。

- **正例（early return）**：`src/app/api/channels/wechat/webhook/[applicationId]/route.ts`、`src/app/api/channels/wechat/bind/route.ts` — 鉴权 / 校验 / 404 先退出，主路径不缩进。
- **正例（JSDoc）**：`METHOD /api/...` 一行路径 + 一行用途；请求体用 `@param request`。
- **命名布尔**：复杂条件先赋名（如 `waitingForFirstHeartbeat`），再参与分支。
- Helper 留在**同文件**；不为「风格统一」抽跨文件工具。

## 规则优先级

### P0 — 必查

| 模式 | 判定 | 首选改写 |
|------|------|----------|
| 嵌套三元（≥2 层 `? :`） | 有序守卫（rebind → gateway → 心跳 → …） | 同文件小函数 + early return，短路顺序不变 |
| 嵌套三元（≥2 层 `? :`） | 离散枚举 → 文案 | `Record` lookup + fallback |

### P1 — 建议查

| 模式 | 首选改写 |
|------|----------|
| 过长单行条件 | 折行或提到命名布尔 |
| JSDoc 路径被拆成多行、缺用途 | `METHOD /path` + 一行说明 |
| 响应对象里塞多层表达式 | 先算命名变量再放入 JSON |
| 可 early return 仍用大 if/else | 扁平守卫 return |

### 明确不做

- 改 `jsonError` vs `NextResponse.json`、`withAuth` vs 裸 `export async function`
- 改响应字段名、字段顺序、HTTP status、文案
- 改短路语义（守卫顺序必须与原三元一致）
- 单层短三元：`error instanceof Error ? message : fallback`、`x?.toISOString() ?? null`、`lastErrorCode ? { code, message } : null`
- 纯偏好（引号风格、无关命名争论）

## 审查输出模板

```markdown
## API 路由可读性审查

### 摘要
- N 处建议处理（P0: x / P1: y）

### Findings
1. **[P0] 嵌套三元 → early return** — `path:line`
   - 现状：简述
   - 建议：给出 5–15 行目标代码片段
2. ...

### 下一步
确认后我可以按上述建议直接改文件（最小 diff，不改行为）。
```

## 重构约束

- 行为不变：短路顺序、返回值、HTTP status、文案一致。
- 提取的 helper 放在同文件、默认不 export。
- 单层、两侧都很短的三元可以保留。
- 跑该 route 已有测试；不为风格改写补行为用例。
