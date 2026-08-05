# PureChat / Vercel AI Gateway · 运营决策与模型校验

> 日期：2026-07-27  
> 关联：[purechat-free-credits.md](./purechat-free-credits.md)

## 1. 运营决策（已锁定）

**V1 采用付费 AI Gateway Credits，保留需求 §6.3 全量 10 模型。**

| 项 | 决策 |
| --- | --- |
| 模型名单 | 保持 §6.3 十个展示 id / Gateway id，不缩到 Free Tier |
| Gateway 档位 | **付费**（采购 Credits）；接受失去每月约 $5 免费层 |
| 原因 | 10 个 id 均在 Gateway 目录中存在；旗舰 + 三档 + 多厂商是产品规格；Free Tier 模型子集与更低 rate limit 无法支撑 |
| 渠道（微信/QQ） | V1 **不消耗**用户免费积分；继续用服务端自配 Key / 独立运营配额 |
| 用户积分上界 | 满额 ≈ **$0.50 / 用户 / 月**（500,000 credits） |

## 2. 模型校验结果（2026-07-27）

`GET https://ai-gateway.vercel.sh/v1/models`（Bearer `AI_GATEWAY_API_KEY`）：核心 10 模型 + Free Tier 2 模型 **exact match**。

Gateway `pricing.*` 为 **每 token USD**；下表换算为 **USD / 百万 tokens**（× 1e6），写入 PureChat 定价卡。

| 展示 id | Gateway id | textInput | textOutput | cacheRead | cacheWrite |
| --- | --- | ---: | ---: | ---: | ---: |
| `gpt-5.5` | `openai/gpt-5.5` | 5.0（≤272k） | 30.0 | 0.5 | — |
| `gpt-5.4-mini` | `openai/gpt-5.4-mini` | 0.75 | 4.5 | 0.075 | — |
| `gpt-5.4-nano` | `openai/gpt-5.4-nano` | 0.2 | 1.25 | 0.02 | — |
| `claude-sonnet-4-6` | `anthropic/claude-sonnet-4.6` | 3.0 | 15.0 | 0.3 | 3.75 |
| `claude-haiku-4-5` | `anthropic/claude-haiku-4.5` | 1.0 | 5.0 | 0.1 | 1.25 |
| `gemini-3.1-pro-preview` | `google/gemini-3.1-pro-preview` | 2.0 | 12.0 | 0.2 | — |
| `gemini-3-flash` | `google/gemini-3-flash` | 0.5 | 3.0 | 0.05 | — |
| `deepseek-v4-pro` | `deepseek/deepseek-v4-pro` | 0.435 | 0.87 | 0.0036 | — |
| `deepseek-v4-flash` | `deepseek/deepseek-v4-flash` | 0.14 | 0.28 | 0.028 | — |
| `glm-5.2` | `zai/glm-5.2` | 1.4 | 4.4 | 0.26 | — |
| `step-3.7-flash` | `stepfun/step-3.7-flash` | 0.2 | 1.15 | 0.04 | — |
| `minimax-m3` | `minimax/minimax-m3` | 0.3 | 1.2 | 0.06 | — |

说明：

- `gpt-5.5` / 部分 Gemini 在 Gateway 有 long-context 分档；V1 PureChat 卡使用 **基础档固定价**（覆盖日常对话）。
- `minimax-m3` 有 long-context 分档（>512k 更高价）；V1 使用基础档固定价。
- `step-3.7-flash` / `minimax-m3`：2026-07-27 在当前 Free Tier 账户实测可通，便于本地未购 Credits 时联调。

## 3. 复验命令

```bash
curl -s "https://ai-gateway.vercel.sh/v1/models" \
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY" | jq '.data[].id' | grep -E 'gpt-5.5|gpt-5.4-mini|claude-sonnet-4.6|glm-5.2|step-3.7-flash|minimax-m3'
```
