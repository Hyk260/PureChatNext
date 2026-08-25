# Lint 与类型检查脚本

根目录 `package.json` 里的质量检查脚本。提交前跑 **`pnpm lint`**；其余命令按需单独执行。

## 怎么用

```bash
pnpm lint              # 聚合检查（不改写文件）
pnpm lint:ts           # 仅 ESLint
pnpm lint:docs         # 公开文档结构、链接与索引
pnpm lint:style:fix    # Stylelint 并自动修复 CSS
pnpm prettier          # Prettier 写回
pnpm prettier:check    # Prettier 只检查
```

`pnpm lint` 只检查、不格式化。需要改写源码时用带 `:fix` 的脚本或 `pnpm prettier`。

## 脚本一览

| 命令 | 职责 | 在 `pnpm lint` 内 | 改写文件 | CI |
| --- | --- | --- | --- | --- |
| `lint` | 并行跑下表「聚合」项，再跑 `typecheck` | — | 否 | 否 |
| `lint:ts` | ESLint（`src/`、`tests/`） | 是 | 否 | 否 |
| `lint:spa-env-imports` | SPA/客户端禁止导入服务端 env | 是 | 否 | 是（独立 job） |
| `lint:style` | Stylelint 检查 CSS | 是 | 否 | 否 |
| `lint:style:fix` | Stylelint 并 `--fix` | 否 | 是 | 否 |
| `lint:circular` | 循环依赖（`src` + `packages` 并行） | 是 | 否 | 否 |
| `lint:docs` | 公开文档结构、链接、锚点和索引可达性 | 是 | 否 | 否 |
| `typecheck` | 根 `tsc --noEmit` | 是（并行组之后） | 否 | 否 |
| `lint:console` | 禁止业务 `console.log/debug` | 否 | 否 | 否 |
| `lint:md` | remark 检查 Markdown | 是 | 否 | 否 |
| `lint:md:fix` | remark `--output` 写回 | 否 | 是 | 否 |
| `lint:unused` | knip 未使用文件/导出 | 否 | 否 | 否 |
| `prettier` | Prettier 写回 | 否 | 是 | 否 |
| `prettier:check` | Prettier 只检查 | 否 | 否 | 否 |
| `check:spa-env-leak` | 扫描 SPA 构建产物是否内联密钥 | 否（挂在 `build`） | 否 | 是 |
| `typecheck:packages` | 各 `@pure/*` 包内 `tsc --noEmit` | 否 | 否 | 否 |

## 聚合链路

```mermaid
flowchart LR
  subgraph parallel [并行]
    lintTs[lint:ts]
    spaEnv[lint:spa-env-imports]
    style[lint:style]
    circular[lint:circular]
    docs[lint:docs]
    markdown[lint:md]
  end
  typecheck[typecheck]
  parallel --> typecheck
```

并行由 [`scripts/run-parallel.mjs`](../../../scripts/run-parallel.mjs) 编排：任一子脚本非 0 即失败。`typecheck` 放在并行组之后，避免与 ESLint / dpdm 抢满 CPU。

`lint:circular` 内部同样并行 `lint:circular:main`（`src/**/*.{ts,tsx}`）与 `lint:circular:packages`（`packages/**/src/**/*.{ts,tsx}`）。

## 逐项说明

### `lint:ts`

```bash
eslint src/ tests/ --concurrency=auto
```

配置：[eslint.config.mjs](../../../eslint.config.mjs)（`eslint-config-next` + 顶层 `import type` 规则）。

规则 glob 写了 `**/*.{ts,tsx}`（含 `packages/**`），但 CLI **只传入** `src/` 与 `tests/`，未传入的目录不会被检查。`packages/` 上仍有存量 TypeScript ESLint 报错（`no-explicit-any`、`no-unsafe-function-type`、`ban-ts-comment` 等），因此尚未扩扫描范围。`scripts/` 也不在范围内。

SPA 客户端另有 `no-restricted-imports`，禁止从 `@/envs`、`@pure/env`、`@/libs/supabase` 导入；与下面的专用脚本互补。

### `lint:spa-env-imports`

[`scripts/check-spa-env-imports.mjs`](../../../scripts/check-spa-env-imports.mjs) 用正则扫客户端目录（`src/spa`、`src/features`、`src/components` 等），包括动态 `import()`。CI 单独跑这一条，避免被其它 ESLint 噪音挡住导入边界问题。

例外：`src/components/Analytics` 允许 `@/envs/analytics`。

### `lint:style` / `lint:style:fix`

Stylelint，配置：[stylelint.config.mjs](../../../stylelint.config.mjs)（standard + Tailwind 4）。扫描 `{src,tests}/**/*.css`；仓库里实际只有 `src/styles/` 与少量 CSS Modules。

`pnpm lint` 走无 `--fix` 的 `lint:style`。需要自动修复时用 `pnpm lint:style:fix`。

### `lint:circular`

[dpdm](https://github.com/acrazing/dpdm) 检测静态循环依赖。`--skip-dynamic-imports circular` 会跳过动态 import 形成的环；`--exit-code circular:1` 发现环则失败。

### `lint:console`（可选）

[`scripts/check-console-log.mts`](../../../scripts/check-console-log.mts) 扫描 `src/` 中的 `console.log` / `console.debug`。允许 `console.warn` / `error` / `info`，并跳过测试文件与生成文件。调试日志请用 `debug` 命名空间，见 [.cursor/rules/debug-usage.md](../../../.cursor/rules/debug-usage.md)。

未纳入 `pnpm lint`。

### `lint:docs`

[`scripts/check-docs.mjs`](../../../scripts/check-docs.mjs) 校验公开文档的目录分类、相对链接、标题锚点和索引可达性。它排除 `docs/private/`，并禁止公开文档使用 locale 后缀或散落在 `docs/` 根目录。

已纳入 `pnpm lint`。

### `lint:md` / `lint:md:fix`

[remark](https://github.com/remarkjs/remark) + `remark-preset-lint-recommended`，配置：[remark.config.mjs](../../../remark.config.mjs)，忽略列表：[.remarkignore](../../../.remarkignore)。

- `lint:md`：`--frail` 有 warning 即退出 1，不写回
- `lint:md:fix`：`--output` 写回

`lint:md` 已纳入 `pnpm lint`。文档目录已从 Prettier 忽略，格式以 remark 为准。

### `lint:unused`（可选）

[knip](https://github.com/webpro-nl/knip)，配置：[knip.json](../../../knip.json)。检查未使用文件、导出、类型、enum 成员与重复导出。噪音较大，适合定期跑，不进聚合。

### `prettier` / `prettier:check`（可选）

配置：[.prettierrc.js](../../../.prettierrc.js)，忽略：[.prettierignore](../../../.prettierignore)（含 `docs/**`、构建产物、lockfile）。`prettier --write .` 会改写匹配文件；CI 或预检用 `prettier:check`。

### `check:spa-env-leak`

[`scripts/check-spa-env-leak.mjs`](../../../scripts/check-spa-env-leak.mjs) 扫描 `dist/` 与 `public/_spa/`，防止服务端密钥被 Vite 内联进前端 bundle。

挂在 `build` / `build:docker` 之后（需先有 SPA 产物），**不是**源码 lint。CI 在 `build:spa` 前注入含 `DO-NOT-LEAK` 的 canary 密钥，再扫描产物。

### `typecheck`

根目录 [`tsconfig.json`](../../../tsconfig.json) 的 `include` 为 `**/*.ts` / `**/*.tsx`，因此 **packages 会一并被检查**，compilerOptions 用的是根配置（`module: esnext`、`moduleResolution: bundler` 等）。

### `typecheck:packages`

```bash
pnpm -r --filter "@pure/*" exec tsc --noEmit
```

只对**自带 `tsconfig.json`** 的包有效。目前是：

- `packages/web-crawler`
- `packages/chat-adapter`
- `packages/model-bank`

其余 `@pure/*` 没有自己的 tsconfig，跑这条会失败。包内配置也可能与根 `typecheck` 不同（例如 `web-crawler` 为 CommonJS）。日常以根 `typecheck` 为准。

## CI

[.github/workflows/ci.yml](../../../.github/workflows/ci.yml) 当前只跑：

1. `lint:spa-env-imports`
2. `build:spa` + `build:spa:copy` + `check:spa-env-leak`（canary 密钥）

**不跑**完整 `pnpm lint`（ESLint、Stylelint、tsc、dpdm）。本地提交前仍应跑 `pnpm lint`。

## 覆盖缺口与剩余优化

本次已做：检查与 `--fix` 分离；`prettier` 去掉互相冲突的 `-c --write`；`lint` / `lint:circular` 并行；公开文档结构检查与 remark 纳入聚合。

刻意未做（避免一次暴露大量存量问题）：

| 项 | 说明 |
| --- | --- |
| `lint:ts` 扩到 `packages/` | 约 40+ 条存量 `@typescript-eslint` 报错，扩范围会变成清理 PR |
| `lint:ts` 扩到 `scripts/` | 脚本以 `.mjs` / `.mts` 为主，未纳入 |
| CI 接入 `pnpm lint` | 目前仅导入边界 + 产物泄漏 |
| `lint:console` 并入聚合或改成 ESLint `no-console` | 可去掉自定义脚本，但需先清存量 `console.log` |
| knip 进 CI 或 `pnpm lint` | 噪音与未使用项存量较多 |
| 给全部 `@pure/*` 补 `tsconfig.json` | 才能让 `typecheck:packages` 覆盖整个 workspace |
