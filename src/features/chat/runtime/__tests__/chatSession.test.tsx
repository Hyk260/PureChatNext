import { useChat } from '@ai-sdk/react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { DefaultChatTransport } from 'ai'
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as chatApi from '@/features/chat/chatApi'
import { getMessageText } from '@/features/chat/messageText'

import ChatRuntimeHost from '../ChatRuntimeHost'
import type { ChatRequestBody, ChatSession } from '../chatSession'
import {
  createChatSession,
  deleteChatSessions,
  findChatSession,
  registerChatSession,
  setChatRuntimeOwner,
  topicRuntimeKey,
  useChatRuntimeStore,
} from '../store'

const mocks = vi.hoisted(() => ({
  userId: 'user-1' as string | null,
  pending: false,
  desktop: undefined as
    { executeLocalTool: ReturnType<typeof vi.fn>; cancelLocalCommand: ReturnType<typeof vi.fn> } | undefined,
}))

vi.mock('@/libs/better-auth/client', () => ({
  useSession: () => ({ data: mocks.userId ? { user: { id: mocks.userId } } : null, isPending: mocks.pending }),
}))
vi.mock('@/types/desktop', () => ({ getDesktopApi: () => mocks.desktop }))

type Request = Parameters<ChatTransport<UIMessage>['sendMessages']>[0]
type Stream = { request: Request; controller: ReadableStreamDefaultController<UIMessageChunk> }
const streams: Stream[] = []
const body: ChatRequestBody = { model: 'model-a', provider: 'provider-a', searchMode: 'auto', system: 'Agent A' }
const seed: UIMessage[] = [{ id: 'seed', role: 'user', parts: [{ type: 'text', text: 'history' }] }]

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

const sessionFor = (topicId = 'topic-a', agentId = 'agent-a', messages: UIMessage[] = []) => {
  const session = createChatSession('user-1', agentId, topicId, messages)
  registerChatSession(session)
  return session
}

const Probe = ({ session }: { session: ChatSession }) => {
  const { messages } = useChat({ chat: session.chat })
  return <div data-testid='visible'>{messages.map(getMessageText).join('|')}</div>
}
const App = ({ visible }: { visible?: ChatSession }) => (
  <>
    <ChatRuntimeHost />
    {visible ? <Probe key={visible.key} session={visible} /> : null}
  </>
)

const start = async (session: ChatSession, config = body, files: File[] = []) => {
  let completion!: Promise<void>
  const count = streams.length
  await act(async () => {
    completion = session.send('question', files, config)
  })
  await waitFor(() => expect(streams.length).toBe(count + 1))
  const stream = streams[count]
  await push(stream, { type: 'start', messageId: `reply-${count}` }, { type: 'start-step' })
  return { stream, completion }
}

const push = async (stream: Stream, ...chunks: UIMessageChunk[]) => {
  await act(async () => {
    chunks.forEach((chunk) => stream.controller.enqueue(chunk))
  })
}
const text = async (stream: Stream, value: string) =>
  push(
    stream,
    { type: 'text-start', id: 'text' },
    { type: 'text-delta', id: 'text', delta: value },
    { type: 'text-end', id: 'text' }
  )
const finish = async (stream: Stream) => {
  await push(stream, { type: 'finish', finishReason: 'stop' })
  await act(async () => {
    stream.controller.close()
  })
}

beforeEach(() => {
  mocks.userId = 'user-1'
  mocks.pending = false
  mocks.desktop = undefined
  streams.length = 0
  setChatRuntimeOwner(null)
  setChatRuntimeOwner('user-1')
  vi.spyOn(chatApi, 'putMessages').mockResolvedValue(undefined)
  vi.spyOn(chatApi, 'upsertToolApproval').mockResolvedValue({})
  vi.spyOn(chatApi, 'updateToolApproval').mockResolvedValue({})
  vi.spyOn(DefaultChatTransport.prototype, 'sendMessages').mockImplementation(
    async (request) =>
      new ReadableStream({
        start(controller) {
          streams.push({ request, controller })
          request.abortSignal?.addEventListener(
            'abort',
            () => controller.error(new DOMException('Stopped', 'AbortError')),
            { once: true }
          )
        },
      })
  )
})
afterEach(() => {
  cleanup()
  setChatRuntimeOwner(null)
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('background chat sessions with the real SDK', () => {
  it('continues off-route, reuses live history and stops only the selected parallel topic', async () => {
    const a = sessionFor()
    const b = sessionFor('topic-b', 'agent-b')
    const app = render(<App visible={a} />)
    const first = await start(a)
    await text(first.stream, 'A starts')
    await waitFor(() => expect(screen.getByTestId('visible').textContent).toContain('A starts'))
    app.rerender(<App visible={b} />)
    const second = await start(b, { ...body, model: 'model-b', system: 'Agent B' })
    await push(
      first.stream,
      { type: 'text-start', id: 'more' },
      { type: 'text-delta', id: 'more', delta: ' in background' },
      { type: 'text-end', id: 'more' }
    )
    expect(screen.getByTestId('visible').textContent).not.toContain('A starts')
    expect(streams[0].request.body).toMatchObject({ model: 'model-a', topicId: 'topic-a', system: 'Agent A' })
    expect(streams[1].request.body).toMatchObject({ model: 'model-b', topicId: 'topic-b', system: 'Agent B' })
    await act(async () => {
      b.stop()
      await second.completion
    })
    expect(a.busy).toBe(true)
    expect(b.busy).toBe(false)
    app.rerender(<App />)
    await finish(first.stream)
    await first.completion
    await a.flush()
    expect(findChatSession('user-1', 'agent-a', 'topic-a')).toBe(a)
    expect(chatApi.putMessages).toHaveBeenCalledWith(
      'topic-a',
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          parts: expect.arrayContaining([expect.objectContaining({ text: ' in background' })]),
        }),
      ])
    )
    app.rerender(<App visible={a} />)
    expect(screen.getByTestId('visible').textContent).toContain('A starts in background')
    expect(useChatRuntimeStore.getState().busy[topicRuntimeKey('agent-a', 'topic-a')]).toBe(false)
  })

  it('locks a topic while attachments are being prepared and sends its file once', async () => {
    const session = sessionFor()
    render(<App visible={session} />)
    const first = await start(session, body, [new File(['hello'], 'hello.txt', { type: 'text/plain' })])
    await session.send('duplicate', [], { ...body, model: 'wrong' })
    expect(streams).toHaveLength(1)
    expect(streams[0].request.messages[0].parts).toContainEqual(
      expect.objectContaining({
        type: 'file',
        filename: 'hello.txt',
        url: expect.stringContaining('data:text/plain;base64,'),
      })
    )
    await text(first.stream, 'done')
    await finish(first.stream)
    await first.completion
  })

  it('executes a desktop tool off-route and keeps the original config for automatic continuation', async () => {
    const tool = deferred<{ success: boolean; content: string }>()
    mocks.desktop = {
      executeLocalTool: vi.fn(() => tool.promise),
      cancelLocalCommand: vi.fn().mockResolvedValue(undefined),
    }
    const session = sessionFor()
    const app = render(<App visible={session} />)
    const config = { ...body, permissionMode: 'auto' as const }
    const first = await start(session, config)
    app.rerender(<App />)
    await push(first.stream, {
      type: 'tool-input-available',
      toolCallId: 'command-1',
      toolName: 'runCommand',
      input: { command: 'pwd' },
    })
    await waitFor(() => expect(mocks.desktop?.executeLocalTool).toHaveBeenCalledOnce())
    expect(session.runningCommandCallIds.has('command-1')).toBe(true)
    config.model = 'changed-after-send'
    await act(async () => {
      tool.resolve({ success: true, content: '/test' })
    })
    await finish(first.stream)
    await waitFor(() => expect(streams).toHaveLength(2))
    expect(streams[1].request.body).toMatchObject({
      model: 'model-a',
      permissionMode: 'auto',
      topicId: 'topic-a',
      system: 'Agent A',
    })
    await push(streams[1], { type: 'start', messageId: 'reply-0' }, { type: 'start-step' })
    await text(streams[1], 'command finished')
    await finish(streams[1])
    await first.completion
    expect(session.runningCommandCallIds.size).toBe(0)
    expect(chatApi.updateToolApproval).toHaveBeenCalledWith('topic-a', 'command-1', 'completed', undefined)
  })

  it('waits for explicit approval in the background and resumes with the original permission mode', async () => {
    mocks.desktop = {
      executeLocalTool: vi.fn().mockResolvedValue({ success: true, content: 'ok' }),
      cancelLocalCommand: vi.fn().mockResolvedValue(undefined),
    }
    const session = sessionFor()
    const app = render(<App visible={session} />)
    const first = await start(session, { ...body, permissionMode: 'ask' })
    await push(first.stream, {
      type: 'tool-input-available',
      toolCallId: 'command-ask',
      toolName: 'runCommand',
      input: { command: 'pwd' },
    })
    await finish(first.stream)
    await first.completion
    app.rerender(<App />)
    expect(session.busy).toBe(false)
    expect(mocks.desktop.executeLocalTool).not.toHaveBeenCalled()
    expect(streams).toHaveLength(1)
    await act(async () => {
      session.approveLocal('command-ask', 'runCommand', { command: 'pwd' }, true)
    })
    await waitFor(() => expect(streams).toHaveLength(2))
    expect(mocks.desktop.executeLocalTool).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'ask', approved: true, topicId: 'topic-a' })
    )
    await push(streams[1], { type: 'start', messageId: 'reply-0' }, { type: 'start-step' })
    await text(streams[1], 'approved')
    await finish(streams[1])
  })

  it('cancels commands and discards late tool output after explicit stop', async () => {
    const tool = deferred<{ success: boolean; content: string }>()
    mocks.desktop = {
      executeLocalTool: vi.fn(() => tool.promise),
      cancelLocalCommand: vi.fn().mockResolvedValue(undefined),
    }
    const session = sessionFor()
    render(<App visible={session} />)
    const first = await start(session, { ...body, permissionMode: 'auto' })
    await push(first.stream, {
      type: 'tool-input-available',
      toolCallId: 'slow',
      toolName: 'runCommand',
      input: { command: 'pwd' },
    })
    await waitFor(() => expect(mocks.desktop?.executeLocalTool).toHaveBeenCalledOnce())
    await act(async () => {
      session.stop()
      tool.resolve({ success: true, content: 'late result' })
      await first.completion
    })
    expect(mocks.desktop.cancelLocalCommand).toHaveBeenCalledWith({ topicId: 'topic-a', toolCallId: 'slow' })
    expect(streams).toHaveLength(1)
    expect(JSON.stringify(session.chat.messages)).not.toContain('late result')
  })

  it('keeps server approvals pending off-route and resumes only after an explicit decision', async () => {
    const session = sessionFor()
    const app = render(<App visible={session} />)
    const first = await start(session, { ...body, permissionMode: 'ask' })
    await push(
      first.stream,
      {
        type: 'tool-input-available',
        toolCallId: 'server-tool',
        toolName: 'webFetch',
        input: { url: 'https://example.com' },
      },
      { type: 'tool-approval-request', toolCallId: 'server-tool', approvalId: 'approval-1' }
    )
    await finish(first.stream)
    await first.completion
    app.rerender(<App />)
    expect(session.busy).toBe(false)
    expect(streams).toHaveLength(1)
    await act(async () => {
      session.approveServer('approval-1', 'server-tool', true)
    })
    await waitFor(() => expect(streams).toHaveLength(2))
    expect(streams[1].request.body).toMatchObject({ model: 'model-a', permissionMode: 'ask' })
    await push(streams[1], { type: 'start', messageId: 'reply-0' }, { type: 'start-step' })
    await text(streams[1], 'server approved')
    await finish(streams[1])
    expect(chatApi.updateToolApproval).toHaveBeenCalledWith('topic-a', 'server-tool', 'approved', undefined)
  })

  it('retains a background error and partial response when returning', async () => {
    const session = sessionFor()
    const app = render(<App visible={session} />)
    const first = await start(session)
    await text(first.stream, 'partial')
    app.rerender(<App />)
    await act(async () => {
      first.stream.controller.error(new Error('upstream failed'))
      await first.completion
    })
    app.rerender(<App visible={session} />)
    expect(session.chat.error?.message).toBe('upstream failed')
    expect(session.busy).toBe(false)
    expect(screen.getByTestId('visible').textContent).toContain('partial')
    await session.flush()
    expect(chatApi.putMessages).toHaveBeenCalledWith('topic-a', session.chat.messages)
  })
})

describe('topic persistence and cleanup', () => {
  it('debounces streaming writes for 400ms and flushes the final response immediately', async () => {
    const session = sessionFor()
    render(<App visible={session} />)
    const first = await start(session)
    await session.flush()
    vi.mocked(chatApi.putMessages).mockClear()
    vi.useFakeTimers()
    await text(first.stream, 'streamed')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(399)
    })
    expect(chatApi.putMessages).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(chatApi.putMessages).toHaveBeenCalledOnce()
    await push(
      first.stream,
      { type: 'text-start', id: 'last' },
      { type: 'text-delta', id: 'last', delta: ' final' },
      { type: 'text-end', id: 'last' }
    )
    await finish(first.stream)
    await first.completion
    await session.flush()
    expect(chatApi.putMessages).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(vi.mocked(chatApi.putMessages).mock.calls[1][1])).toContain(' final')
  })
  it('does not PUT on hydration and serializes writes while keeping only the newest queued snapshot', async () => {
    const session = sessionFor('topic-a', 'agent-a', seed)
    render(<App visible={session} />)
    expect(chatApi.putMessages).not.toHaveBeenCalled()
    const writing = deferred<void>()
    vi.mocked(chatApi.putMessages).mockImplementationOnce(() => writing.promise)
    await act(async () => {
      session.edit('seed', 'first')
    })
    await waitFor(() => expect(chatApi.putMessages).toHaveBeenCalledTimes(1))
    await act(async () => {
      session.edit('seed', 'second')
      session.edit('seed', 'third')
    })
    expect(chatApi.putMessages).toHaveBeenCalledTimes(1)
    await act(async () => {
      writing.resolve()
      await session.flush()
    })
    expect(chatApi.putMessages).toHaveBeenCalledTimes(2)
    expect(vi.mocked(chatApi.putMessages).mock.calls[1][1][0].parts).toEqual([{ type: 'text', text: 'third' }])
  })

  it('keeps a dirty snapshot after failure and retries it on re-entry', async () => {
    const session = sessionFor('topic-a', 'agent-a', seed)
    render(<App visible={session} />)
    vi.mocked(chatApi.putMessages).mockRejectedValueOnce(new Error('save failed'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => {
      session.edit('seed', 'unsaved')
    })
    await waitFor(() => expect(log).toHaveBeenCalledWith('[chat] putMessages failed', expect.any(Error)))
    await session.flush()
    expect(chatApi.putMessages).toHaveBeenCalledTimes(2)
    expect(vi.mocked(chatApi.putMessages).mock.calls[1][1][0].parts).toEqual([{ type: 'text', text: 'unsaved' }])
  })

  it('drains an in-flight write before deletion and never writes a late snapshot after deletion', async () => {
    const session = sessionFor('topic-a', 'agent-a', seed)
    render(<App visible={session} />)
    const writing = deferred<void>()
    vi.mocked(chatApi.putMessages).mockImplementationOnce(() => writing.promise)
    await act(async () => {
      session.edit('seed', 'first')
    })
    const remove = vi.fn().mockResolvedValue(['topic-a'])
    let deletion!: Promise<string[]>
    await act(async () => {
      deletion = deleteChatSessions('user-1', 'agent-a', ['topic-a'], remove)
    })
    expect(remove).not.toHaveBeenCalled()
    await act(async () => {
      writing.resolve()
      await deletion
    })
    expect(remove).toHaveBeenCalledOnce()
    await act(async () => {
      session.chat.messages = seed
      session.observe(seed)
      await session.flush()
    })
    expect(chatApi.putMessages).toHaveBeenCalledTimes(1)
    expect(findChatSession('user-1', 'agent-a', 'topic-a')).toBeUndefined()
  })

  it('retains the stopped session and its messages when deletion fails', async () => {
    const session = sessionFor('topic-a', 'agent-a', seed)
    render(<App visible={session} />)
    await act(async () => {
      await expect(
        deleteChatSessions('user-1', 'agent-a', ['topic-a'], async () => {
          throw new Error('delete failed')
        })
      ).rejects.toThrow('delete failed')
    })
    expect(findChatSession('user-1', 'agent-a', 'topic-a')).toBe(session)
    expect(session.chat.messages).toEqual(seed)
    await act(async () => {
      session.edit('seed', 'still editable')
    })
    await session.flush()
    expect(chatApi.putMessages).toHaveBeenCalledWith('topic-a', session.chat.messages)
  })

  it('keeps tasks on transient auth refresh, but cancels and clears them on account change', async () => {
    const session = sessionFor()
    const app = render(<App visible={session} />)
    const first = await start(session)
    mocks.pending = true
    mocks.userId = null
    app.rerender(<App />)
    expect(session.busy).toBe(true)
    mocks.pending = false
    mocks.userId = 'user-2'
    app.rerender(<App />)
    await act(async () => {
      await first.completion
    })
    expect(useChatRuntimeStore.getState().sessions.size).toBe(0)
    expect(session.busy).toBe(false)
    expect(registerChatSession(session)).toBe(false)
  })
})
