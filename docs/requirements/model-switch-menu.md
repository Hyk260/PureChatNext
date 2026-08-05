# 模型切换菜单 · 需求规格

> 状态：已锁定（V1）  
> 受众：PureChatNext 实现侧  
> 范围：聊天输入区模型下拉（`ModelSwitchMenu`）

---

## 1. 背景与目标

聊天输入区需要更可发现的模型选择体验：用户能快速搜索、按视图浏览已启用模型，并在悬停时查看元数据；同一模型 id 在多个服务商可用时，可在详情中切换通道。

V1 目标：

1. 保留搜索；工具栏右侧增加 **按模型 / 按供应商** 视图切换。
2. 鼠标悬停模型行时，右侧弹出详情（描述、上下文、能力、价格）。
3. **按供应商**：分组标题 + 右侧齿轮跳转对应服务商设置页。
4. **按模型**：按 `model` id 跨服务商聚合；多通道时详情底部可切换供应商。

---

## 2. 术语

| 术语 | 定义 |
| --- | --- |
| **按模型（byModel）** | 列表按模型 id 去重聚合；一行对应一个逻辑模型。 |
| **按供应商（byProvider）** | 列表按已启用服务商分组，组内列出该通道下已启用模型。 |
| **详情面板** | 悬停模型行时在菜单右侧打开的 submenu。 |
| **通道** | `(providerId, modelId)` 二元组；选择态写入 HomeStore。 |

---

## 3. 非目标（V1 明确不做）

| 项 | 说明 |
| --- | --- |
| 雷达图（智力 / Agentic 等） | 无产品数据源 |
| 面板拖拽改宽 | 固定宽度即可 |
| 图片 / 视频生成定价模式 | 仅 Chat 文本模型 |
| 视图模式全局持久化 | 会话内记住即可 |
| 底部「全部服务商」Footer | 可选后续再加 |

---

## 4. 已锁定决策

| 项 | 决策 |
| --- | --- |
| 默认视图 | `byModel` |
| 聚合键 | `model` id（非 displayName） |
| 多通道默认优先 | `purechat` 排前 |
| 详情数据源 | `getAiModel(provider, modelId)`（model-bank） |
| 列表数据源 | `useProviderConfigStore` 已启用服务商 × 已启用模型 |
| USD 价格展示 | 换算为积分/百万 tokens（`1 USD = 1_000_000` 积分） |
| CNY 价格展示 | `¥ / 百万 tokens` |
| 设置跳转 | `/settings/provider/${providerId}` |
| 视图切换 | 对所有用户可见 |

---

## 5. 交互规格

### 5.1 工具栏

- 左侧：搜索框，placeholder「搜索模型...」
- 右侧：两个图标按钮 —— Brain = 按模型，Provider 图标 = 按供应商；当前模式高亮
- 关闭菜单时清空搜索词；**不重置** `groupMode`

### 5.2 按供应商

- 每个已启用服务商：`group-header`（图标 + 名称 + 右侧齿轮）
- 齿轮：跳转 `/settings/provider/${id}` 并关闭菜单（`stopPropagation`）
- 无匹配模型且有搜索词：跳过该组；无搜索词且无模型：可显示空态行（可选）
- 模型行：图标 + 显示名 + 能力/上下文 Tag；点击选中并关闭
- 悬停：打开详情（无供应商切换列表）

### 5.3 按模型

- 跨服务商按 model id 聚合；`purechat` 优先
- 单通道：点击即选；悬停开详情
- 多通道：点击选默认第一个通道（purechat 优先）；悬停详情底部「使用此模型来自」列出通道，点选具体 `(provider, model)`

### 5.4 详情面板

| 区块 | 规则 |
| --- | --- |
| 描述 | 有 `description` 则显示 |
| 上下文 | 有 `contextWindowTokens` 则显示（如 `1M tokens`） |
| 能力 | functionCall / vision / reasoning 等有则显示 Tag |
| 价格 | 有 `pricing` 则显示输入 / 输出 / 缓存读取（有则） |
| 缺元数据 | 对应区块隐藏，面板仍可打开 |

面板宽度约 `400px`；主列表宽度约 `300px`。

---

## 6. 验收清单

- [ ] 工具栏可在按模型 / 按供应商间切换，默认按模型
- [ ] 按供应商显示分组标题，齿轮进入对应设置页
- [ ] 悬停模型行出现详情（描述 / 上下文 / 能力 / 价格，按数据有无显示）
- [ ] 同一 model id 在 PureChat 与自配通道同时启用时，按模型视图可聚合，详情可切换通道
- [ ] 搜索过滤模型名 / id / 服务商名
- [ ] 选中后写入 `selectedProvider` + `selectedModel`，触发器显示更新
- [ ] `ModelSelector` / `ModelLabel` 无需改调用方 API

---

## 7. 实现落点

| 区域 | 路径 |
| --- | --- |
| UI | `src/features/chat/ModelSwitchMenu/` |
| Submenu 桥接 | `packages/ui/src/DropdownMenu` |
| 元数据 | `@pure/model-bank` |
| 能力 Tag | `src/features/community/components/ModelFeatureTags.tsx` |
