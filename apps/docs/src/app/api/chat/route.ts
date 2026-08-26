import { llmEnv } from '@pure/env/llm'
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
} from 'ai'
import { docsTools } from '@/lib/ai'
import type { AskAISkillId } from '@/lib/ask-ai-config'
import { getAIStreamErrorMessage, MAX_BODY_BYTES, parseChatRequest } from '@/lib/chat-request'

export const maxDuration = 30

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status })
}

function hasGatewayCredentials() {
  return Boolean(llmEnv.AI_GATEWAY_API_KEY?.trim() || llmEnv.VERCEL_OIDC_TOKEN?.trim())
}

const SKILL_INSTRUCTIONS: Record<AskAISkillId, string> = {
  'deep-research': '扩大检索范围，必要时多次调用 searchDocs 交叉核对，并附上所有关键结论对应的文档来源。',
  'step-by-step': '按前置条件、编号步骤和验证方式组织回答；命令与配置必须使用清晰的代码块。',
  summarize: '先给出简洁结论和关键要点，再补充理解答案所必需的说明。',
  troubleshoot: '按问题现象、可能原因、检查方法和修复建议组织回答，并优先给出低风险检查项。',
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) return jsonError('请求内容过大', 400)

  const rawBody = await request.text()
  const parsed = await parseChatRequest(rawBody)
  if (!parsed.success) return jsonError(parsed.error, 400)
  if (!hasGatewayCredentials()) return jsonError('Ask AI 暂未配置，请稍后再试', 503)

  const { messages, model, page, skills } = parsed.data
  const skillInstructions = skills.map((skill) => SKILL_INSTRUCTIONS[skill]).join('\n')

  const result = streamText({
    instructions: `你是 PureChatNext 公开文档助手。当前页面是 ${page ?? '未知页面'}。
回答前必须调用 searchDocs。只依据工具返回的公开文档回答，不要使用外部知识猜测。
回答使用简洁中文，并在相关结论后附上 Markdown 格式的文档链接。链接必须使用站点相对路径（例如 /self-hosting/features/online-search），不要使用完整域名。
如果文档中没有答案，明确回答“当前公开文档中没有找到相关说明”，并建议用户在 GitHub 提交问题。${skillInstructions ? `\n本轮回答方式：\n${skillInstructions}` : ''}`,
    maxOutputTokens: 1000,
    messages: await convertToModelMessages(messages, { tools: docsTools }),
    model,
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
