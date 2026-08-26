import { describe, expect, it } from 'vitest'
import { DEFAULT_ASK_AI_MODEL } from '@/lib/ask-ai-config'
import { getAIStreamErrorMessage, MAX_BODY_BYTES, parseChatRequest } from '@/lib/chat-request'

function message(text: string) {
  return { id: 'message-1', parts: [{ text, type: 'text' }], role: 'user' }
}

describe('Ask AI request validation', () => {
  it('accepts a short text-only user request', async () => {
    const result = await parseChatRequest(JSON.stringify({ messages: [message('如何开始？')], page: '/' }))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.model).toBe(DEFAULT_ASK_AI_MODEL)
      expect(result.data.skills).toEqual([])
    }
  })

  it('accepts allowlisted models and document answer skills', async () => {
    const result = await parseChatRequest(
      JSON.stringify({
        messages: [message('如何排查？')],
        model: 'alibaba/qwen3.5-plus',
        skills: ['deep-research', 'troubleshoot'],
      }),
    )

    expect(result).toMatchObject({
      data: { model: 'alibaba/qwen3.5-plus', skills: ['deep-research', 'troubleshoot'] },
      success: true,
    })
  })

  it('rejects unknown models, skills and excessive skill selections', async () => {
    const base = { messages: [message('如何开始？')] }

    await expect(parseChatRequest(JSON.stringify({ ...base, model: 'openai/unknown' }))).resolves.toEqual({
      error: '消息格式无效',
      success: false,
    })
    await expect(parseChatRequest(JSON.stringify({ ...base, skills: ['web-search'] }))).resolves.toEqual({
      error: '消息格式无效',
      success: false,
    })
    await expect(
      parseChatRequest(JSON.stringify({ ...base, skills: ['summarize', 'summarize'] })),
    ).resolves.toEqual({ error: '消息格式无效', success: false })
    await expect(
      parseChatRequest(
        JSON.stringify({
          ...base,
          skills: ['deep-research', 'summarize', 'step-by-step', 'troubleshoot', 'summarize'],
        }),
      ),
    ).resolves.toEqual({ error: '消息格式无效', success: false })
  })

  it('rejects oversized bodies and user messages', async () => {
    await expect(parseChatRequest('x'.repeat(MAX_BODY_BYTES + 1))).resolves.toEqual({
      error: '请求内容过大',
      success: false,
    })

    const result = await parseChatRequest(JSON.stringify({ messages: [message('问'.repeat(1001))] }))
    expect(result).toEqual({ error: '消息内容无效', success: false })
  })

  it('rejects files and unknown tool history', async () => {
    const withFile = {
      id: 'message-1',
      parts: [{ mediaType: 'text/plain', type: 'file', url: 'https://example.com/file.txt' }],
      role: 'user',
    }
    expect(await parseChatRequest(JSON.stringify({ messages: [withFile] }))).toEqual({
      error: '消息内容无效',
      success: false,
    })

    const unknownTool = {
      id: 'message-2',
      parts: [{ input: {}, state: 'input-available', toolCallId: 'tool-1', type: 'tool-unknown' }],
      role: 'assistant',
    }
    expect(await parseChatRequest(JSON.stringify({ messages: [unknownTool, message('继续')] }))).toEqual({
      error: '消息内容无效',
      success: false,
    })
  })

  it('returns safe stream errors', () => {
    expect(getAIStreamErrorMessage(new Error('upstream 429 rate limit'))).toContain('请求较多')
    expect(getAIStreamErrorMessage(new Error('secret provider failure'))).not.toContain('secret')
  })
})
