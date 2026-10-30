import { afterEach, describe, expect, it, vi } from 'vitest'

import { createLmStudioChatResponse } from './lmStudioChat'

const input = {
  messages: [{ id: 'user-1', parts: [{ text: 'hello', type: 'text' as const }], role: 'user' as const }],
  model: 'local-model',
  providerId: 'lmstudio',
}

const openAIStream = () =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(
          encoder.encode(
            'data: {"id":"chat-1","object":"chat.completion.chunk","created":1,"model":"local-model","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n'
          )
        )
        controller.enqueue(
          encoder.encode(
            'data: {"id":"chat-1","object":"chat.completion.chunk","created":1,"model":"local-model","choices":[{"index":0,"delta":{"content":"hello from LM Studio"},"finish_reason":null}]}\n\n'
          )
        )
        controller.enqueue(
          encoder.encode(
            'data: {"id":"chat-1","object":"chat.completion.chunk","created":1,"model":"local-model","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n'
          )
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } }
  )

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LM Studio direct chat runtime', () => {
  it('streams chat from the configured endpoint in the renderer', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(openAIStream())
    vi.stubGlobal('fetch', fetchMock)

    const response = await createLmStudioChatResponse(
      input,
      { apiKey: 'local-key', baseURL: 'https://proxy.example.com/v1' },
      new AbortController().signal
    )
    const stream = await response.text()

    expect(response.status).toBe(200)
    expect(stream).toContain('hello from LM Studio')
    expect((fetchMock.mock.calls[0]?.[0] as Request | undefined)?.url).toBe(
      'https://proxy.example.com/v1/chat/completions'
    )
  })

  it('propagates cancellation to the active provider request', async () => {
    let providerSignal: AbortSignal | undefined
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      providerSignal = init?.signal as AbortSignal | undefined
      const signal = init?.signal as AbortSignal | undefined
      return Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('data: {"id":"chat-1","choices":[{"delta":{"role":"assistant"},"index":0,"finish_reason":null}]}\n\n'))
              signal?.addEventListener('abort', () => controller.error(signal.reason), { once: true })
            },
          }),
          { headers: { 'Content-Type': 'text/event-stream' } }
        )
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const abortController = new AbortController()
    const response = await createLmStudioChatResponse(
      input,
      { baseURL: 'http://localhost:1234/v1' },
      abortController.signal
    )
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Missing chat response body')
    await reader.read()
    await vi.waitFor(() => expect(providerSignal).toBeDefined())
    expect(new Headers((fetchMock.mock.calls[0]?.[0] as Request | undefined)?.headers).get('Authorization')).toBeNull()
    abortController.abort(new Error('stopped'))
    await vi.waitFor(() => expect(providerSignal?.aborted).toBe(true))
    await reader.cancel()
  })
})
