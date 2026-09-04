import { SHANGHAI_TIMEZONE } from '@pure/const'
import { isStepCount } from 'ai'
import type { ModelMessage } from 'ai'
import type { Message, Thread } from 'chat'
import debug from 'debug'

import { resolveChatToolInstructions, resolveChatTools } from '@/server/chat/toolRegistry'
import type { WechatToolArtifact, WechatToolContext } from '@/server/chat/toolRegistry'

import { generateChannelAgentReply } from '../core/agentRuntime'
import { buildChannelContextMessages } from '../core/context'
import type { ChannelGenerationOptions } from '../core/types'

const log = debug('channel:wechat:bridge')
const MAX_GENERATION_STEPS = 5
const FINAL_ANSWER_STEP = 3
type WechatUserContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'file'; data: string | Uint8Array | URL; mediaType: string; filename?: string }
    >

export type WechatAgentReply = {
  artifacts: WechatToolArtifact[]
  durationMs: number
  model: string
  provider: string
  text: string
}

export const buildWechatRuntimeInstructions = (now = new Date()) => {
  const currentTime = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'full',
    timeStyle: 'long',
    timeZone: SHANGHAI_TIMEZONE,
  }).format(now)

  return [
    `当前服务器时间：${currentTime}（${SHANGHAI_TIMEZONE}）。涉及“今天、明天、现在”等相对时间时，以此为准。`,
    '调用工具后必须给出完整最终回答，不要只回复“正在查询”或“稍等”。引用网页资料时附上来源 URL。',
    '不得声称已修改、生成或发送文件，除非相应文件工具明确返回 success=true。',
  ].join('\n')
}

/** 使用绑定 Agent 生成文本回复（环境级 provider 密钥或 PureChat 积分）。 */
export async function generateWechatAgentReply(params: {
  abortSignal?: AbortSignal
  agentId: string
  history?: Array<{ content: string; responseText: string | null }>
  model: string
  provider: string
  userId: string
  userText: string
  userContent?: WechatUserContent
  attachmentContext?: string
  wechatToolContext?: WechatToolContext
}): Promise<WechatAgentReply> {
  const toolContext = { channel: 'wechat' as const, searchMode: 'auto' as const, wechat: params.wechatToolContext }
  const tools = resolveChatTools(toolContext)

  const messages: ModelMessage[] = buildChannelContextMessages(params.history ?? [])
  messages.push({ content: params.userContent ?? params.userText, role: 'user' })
  const generation: ChannelGenerationOptions = {
    instructions: [
      buildWechatRuntimeInstructions(),
      ...resolveChatToolInstructions(toolContext),
      params.attachmentContext,
    ].filter(Boolean).join('\n\n'),
    messages,
    onStepEnd: (event) => {
      const step = event as {
        finishReason?: string
        stepNumber?: number
        toolCalls?: Array<{ toolName: string }>
        toolResults?: unknown[]
      }
      log(
        'step platform=wechat step=%d finish=%s tools=%s results=%d',
        step.stepNumber ?? 0,
        step.finishReason ?? '-',
        step.toolCalls?.map((call) => call.toolName).join(',') || '-',
        step.toolResults?.length ?? 0
      )
    },
    prepareStep: (event) => {
      const stepNumber = (event as { stepNumber?: number }).stepNumber ?? 0
      return stepNumber >= FINAL_ANSWER_STEP ? { activeTools: [], toolChoice: 'none' as const } : undefined
    },
    stopWhen: isStepCount(MAX_GENERATION_STEPS),
    tools,
  }
  const result = await generateChannelAgentReply({
    abortSignal: params.abortSignal,
    agentId: params.agentId,
    generation,
    model: params.model,
    platform: 'wechat',
    provider: params.provider,
    text: params.userText,
    userId: params.userId,
  })

  return {
    artifacts: params.wechatToolContext?.producedArtifacts ?? [],
    durationMs: result.durationMs,
    model: result.model,
    provider: result.provider,
    text: result.text,
  }
}

/** Chat SDK 处理器：入站私聊 → Agent → thread.post。 */
export async function handleWechatMention(params: {
  agentId: string
  message: Message
  model: string
  provider: string
  thread: Thread
  userId: string
}): Promise<void> {
  const { agentId, message, model, provider, thread, userId } = params

  if (message.author?.isBot === true) return

  const userText = message.text?.trim()
  if (!userText) return

  try {
    await thread.startTyping().catch(() => {
      /* 正在输入指示为尽力而为 */
    })

    const reply = await generateWechatAgentReply({ agentId, model, provider, userId, userText })
    await thread.post({ markdown: reply.text })
  } catch (error) {
    log('handleMention failed agent=%s: %O', agentId, error)
    const errMsg = error instanceof Error ? error.message : '处理失败'
    try {
      await thread.post({ markdown: `⚠️ ${errMsg}` })
    } catch {
      /* 忽略发送失败 */
    }
  }
}
