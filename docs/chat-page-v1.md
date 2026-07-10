# Chat 页 v1 需求文档

## 目标

把 `/chat` 从 AI SDK demo 升级为可用的本地聊天页：支持选择 OpenAI / DeepSeek 模型、输入区对齐产品参考图、刷新后消息不丢失。

## 功能需求

| ID | 需求 | 验收标准 |
|----|------|----------|
| F1 | 模型选择 | 可在 OpenAI / DeepSeek 模型间切换；发送请求 body 含 `provider`、`model`；服务端按选择调用对应 SDK |
| F2 | 输入区 UI | 圆角卡片 + 阴影；多行 textarea；左下操作区、右下模型选择 + 发送；placeholder 与参考图一致 |
| F3 | 本地消息持久化 | `UIMessage[]` 存浏览器本地；刷新后恢复；流式过程中持续写入，结束后保留完整消息 |

## 非目标（v1 不做）

- 多会话列表 / 服务端落库
- `@` 提及智能体、附件上传、工具调用 UI
- 断线续传（Resume Streams）

## 技术约束

- **模型**：复用 `HOME_MODELS` + 现有 `ModelSelector` / `useHomeStore`（模型偏好已 persist）
- **传参**：`DefaultChatTransport` 的 `body` 动态带上 `provider`、`model`（对齐 [AI SDK Chatbot](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot)）
- **持久化**：`localStorage` 单会话（key：`purechat:chat:v1:messages`）；存 `UIMessage` 格式；客户端 hydration 后再挂载 `useChat`，避免 SSR 不一致
- **UI 栈**：`@lobehub/ui` + `antd-style` `createStaticStyles`，风格对齐 `HomeChatInput`
- **API**：`POST /api/chat` 已支持 `provider` + `model`，密钥走 `OPENAI_API_KEY` / `DEEPSEEK_API_KEY`

## 数据流

```text
ChatPage → useChat → DefaultChatTransport → POST /api/chat → resolveModel → OpenAI | DeepSeek
                ↘ localStorage (UIMessage[])
```

## 验收清单

- [ ] 切换 OpenAI / DeepSeek 后发送，网络请求 body 含正确 `provider`/`model`
- [ ] 输入区视觉接近参考图（圆角、阴影、底栏布局）
- [ ] 对话后刷新页面，历史消息仍在
- [ ] 无密钥时错误可感知
