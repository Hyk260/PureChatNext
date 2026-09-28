---
title: Ponytail 使用指南
description: 在 Codex 或 Claude Code 中安装 Ponytail，控制代码实现范围并检查过度设计。
---

# Ponytail 使用指南

[Ponytail](https://github.com/DietrichGebert/ponytail) 是 AI 编程助手的插件。它引导助手先理解现有代码，再依次考虑是否无需新增代码、能否复用仓库实现、标准库、平台原生能力或已有依赖，最后才编写必要的新代码。它不替代测试、输入校验、安全处理或无障碍要求。

## 在 Codex 中安装

确保 `node` 和 `codex` 命令可用，然后在终端执行：

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

运行 `codex`，打开 `/hooks`，检查并信任 Ponytail 的两个生命周期 hook，然后新建会话。使用 Codex 桌面版时，安装后重启应用。`node` 需要在非交互式 shell 的 `PATH` 中；否则技能仍可使用，但自动启用不会生效。

安装后默认使用 `full` 模式。四种模式的侧重点如下：

| 模式 | 说明 |
| --- | --- |
| `lite` | 轻量提醒，仅在实现过程中给出简短的范围控制建议，适合小改动和日常修复。 |
| `full` | 标准模式，在编码前后检查复用机会、实现范围和过度设计，适合大多数开发任务。 |
| `ultra` | 强约束模式，更严格地审查设计复杂度和新增代码，适合需要严格控制变更范围的任务。 |
| `off` | 关闭 Ponytail 的自动介入；仍可手动调用相关技能。 |

可在新会话中让助手报告当前 Ponytail 模式，以确认是否生效。

## 日常使用

正常描述开发任务即可。需要明确调用功能时，在 Codex 中以 `@` 调用技能：

| 调用 | 用途 |
| --- | --- |
| `@ponytail` | 查看或设置模式：`lite`、`full`、`ultra`、`off` |
| `@ponytail-review` | 检查当前代码差异中的过度设计 |
| `@ponytail-audit` | 检查整个仓库中的过度设计 |
| `@ponytail-debt` | 汇总标记为 `ponytail:` 的待处理项 |
| `@ponytail-help` | 查看命令速览 |

例如，完成功能修改后可输入 `@ponytail-review`，再逐项判断其建议是否适合当前需求。Ponytail 的建议不能覆盖本仓库的 [Agent 开发规则](../../AGENTS.md)：仍要先阅读涉及的源码和文档、只做任务相关的最小修改，并执行相称的检查。

如果要让所有新会话默认采用指定模式，可以设置 `PONYTAIL_DEFAULT_MODE` 环境变量为 `lite`、`full`、`ultra` 或 `off`；不设置时默认为 `full`。

## 在 VS Code 中使用

在 VS Code 中安装 Ponytail 后，打开 Copilot Chat 并开始新会话。正常描述开发任务即可；需要明确调用功能时，在聊天输入框中使用对应的技能命令：

```text
@ponytail
@ponytail-review
```

其中 `@ponytail` 用于查看或设置模式，`@ponytail-review` 用于检查当前代码差异中的过度设计。若扩展安装后没有生效，请重启 VS Code，再新建一个 Copilot Chat 会话。

## 卸载

Codex 中执行：

```bash
codex plugin remove ponytail
```

Claude Code 中执行 `/plugin remove ponytail`。卸载插件可能保留模式配置等本地状态；完整清理步骤见 [项目 README 的卸载说明](https://github.com/DietrichGebert/ponytail#uninstall)。

更多适配平台和命令见 [Ponytail README](https://github.com/DietrichGebert/ponytail#commands)。
