import { llmEnv } from '@pure/env/llm'
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
} from 'ai'
import { docsTools } from '@/lib/ai'
import { getAIStreamErrorMessage, MAX_BODY_BYTES, parseChatRequest } from '@/lib/chat-request'

export const maxDuration = 30

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status })
}

function hasGatewayCredentials() {
  return Boolean(llmEnv.AI_GATEWAY_API_KEY?.trim() || llmEnv.VERCEL_OIDC_TOKEN?.trim())
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) return jsonError('请求内容过大', 400)

  const rawBody = await request.text()
  const parsed = await parseChatRequest(rawBody)
  if (!parsed.success) return jsonError(parsed.error, 400)
  if (!hasGatewayCredentials()) return jsonError('Ask AI 暂未配置，请稍后再试', 503)

  const { messages, page } = parsed.data

  const result = streamText({
    instructions: `你是 PureChatNext 公开文档助手。当前页面是 ${page ?? '未知页面'}。
回答前必须调用 searchDocs。只依据工具返回的公开文档回答，不要使用外部知识猜测。
回答使用简洁中文，并在相关结论后附上 Markdown 格式的文档链接。
如果文档中没有答案，明确回答“当前公开文档中没有找到相关说明”，并建议用户在 GitHub 提交问题。`,
    maxOutputTokens: 1000,
    messages: await convertToModelMessages(messages, { tools: docsTools }),
    model: 'openai/gpt-5.4-mini',
    stopWhen: stepCountIs(3),
    tools: docsTools,
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      onError(error) {
        return getAIStreamErrorMessage(error)
      },
      originalMessages: messages,
      stream: result.stream,
      tools: docsTools,
    }),
  })
}
