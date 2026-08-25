# 参与贡献

感谢你改进 PureChat。小范围修复可以直接提交 Pull Request；较大的功能、架构调整或不兼容变更，请先在 [Discussions](https://github.com/Hyk260/PureChatNext/discussions) 说明使用场景与方案。

## 开始前

1. 搜索现有 Issue 和 Pull Request，避免重复工作。
2. 缺陷请提供最小复现；功能建议请说明目标用户与成功标准。
3. 不要在 Issue、日志或截图中提交 API Key、Cookie、数据库连接串和渠道凭证。

## 本地开发

```bash
git clone https://github.com/Hyk260/PureChatNext.git
cd PureChatNext
pnpm install
cp .env.example .env.local
pnpm dev
```

本地访问 `http://localhost:5174`；Next API / BFF 默认运行在 `http://localhost:3000`。完整配置见 [快速开始](./docs/getting-started/quick-start.md)。

## 开发约定

- 包管理器只使用 pnpm；开发脚本可由本机 Bun 执行。
- 共享逻辑优先放入 `packages/`，环境变量统一定义在 `packages/env/src/`。
- 只修改与目标相关的代码，不在同一 PR 中混入无关重构。
- 新行为应补充测试；新增环境变量时同步更新 `.env.example` 与文档。
- 提交信息建议使用中文描述和 conventional 前缀，例如 `feat:`、`fix:`、`docs:`。

## 提交前检查

```bash
pnpm lint
pnpm exec vitest run --silent='passed-only'
pnpm build
```

针对单个 workspace package 的测试请在相应 package 目录执行。Pull Request 中请说明测试范围、风险和人工验证结果；涉及 UI 时附上脱敏截图或录屏。

## 行为准则

请围绕问题本身友善、具体地沟通，尊重不同经验背景。骚扰、人身攻击、泄露隐私或恶意破坏会被移除并可能导致限制参与。
