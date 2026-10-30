import { beforeEach, describe, expect, it, vi } from 'vitest'

import { QQApiClient } from '../api'

const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json', ...headers },
    status,
  })

describe('QQ passive speech transport', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('uploads bytes as voice with a filename and never uses active sending', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ file_info: 'voice-file' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'sent' }))
    const api = new QQApiClient('app', 'secret')
    const signal = new AbortController().signal
    expect(await api.uploadSpeech('group', 'group-id', Buffer.from('ID3-audio'), signal)).toBe('voice-file')
    await api.sendPassiveReply('group', 'group-id', { fileInfo: 'voice-file' }, { msgId: 'inbound', msgSeq: 1 }, signal)
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({ file_type: 3, file_name: 'reply.mp3', file_data: Buffer.from('ID3-audio').toString('base64'), srv_send_msg: false })
    expect(JSON.parse(String(fetch.mock.calls[2][1]?.body))).toMatchObject({ msg_type: 7, media: { file_info: 'voice-file' }, msg_id: 'inbound', msg_seq: 1 })
  })

  it('does not retry uncertain delivery and hides upstream bodies', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token', expires_in: 3600 }))
      .mockRejectedValueOnce(new Error('secret upstream URL'))
    const api = new QQApiClient('app', 'secret')
    await expect(api.sendPassiveReply('c2c', 'user', { fileInfo: 'file' }, { msgId: 'inbound', msgSeq: 1 }, new AbortController().signal)).rejects.toMatchObject({ code: 'QQ_DELIVERY_UNKNOWN', kind: 'unknown', message: 'QQ_DELIVERY_UNKNOWN' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('requires an actual message acknowledgement even after HTTP 200', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({}))
    await expect(new QQApiClient('app', 'secret').sendPassiveReply('c2c', 'user', { fileInfo: 'file' }, { msgId: 'inbound', msgSeq: 1 }, new AbortController().signal)).rejects.toMatchObject({ code: 'QQ_DELIVERY_UNKNOWN', kind: 'unknown' })
  })

  it('distinguishes explicit rejection and rejects missing reply context without network I/O', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ code: 850018, message: 'sensitive body' }, 403))
    const api = new QQApiClient('app', 'secret')
    const signal = new AbortController().signal
    await expect(api.sendPassiveReply('group', 'group', { text: 'text' }, { msgId: 'inbound', msgSeq: 1 }, signal)).rejects.toMatchObject({ code: 'QQ_850018', kind: 'rejected' })
    await expect(api.sendPassiveReply('group', 'group', { text: 'text' }, {}, signal)).rejects.toMatchObject({ code: 'QQ_PASSIVE_CONTEXT_MISSING' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe('QQApiClient retry behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('retries rate limits using Retry-After', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(new Response('rate limited', { headers: { 'retry-after': '0' }, status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ id: 'message-1', timestamp: '2026-09-03T00:00:00.000Z' }))

    const response = await new QQApiClient('app-id', 'secret').sendC2CMessage('user-id', 'hello')

    expect(response.id).toBe('message-1')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('returns the final server error after retry attempts', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token', expires_in: 3600 }))
      .mockImplementation(async () => new Response('unavailable', { status: 503 }))

    await expect(new QQApiClient('app-id', 'secret').sendC2CMessage('user-id', 'hello')).rejects.toThrow(
      'QQ API POST /v2/users/user-id/messages failed: 503'
    )
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})

describe('QQApiClient active C2C messages', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends without passive-reply identifiers', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ id: 'message-1', timestamp: '2026-10-28T00:00:00.000Z' }))

    await new QQApiClient('app-id', 'secret').sendC2CActiveMessage('openid / owner', '喝水提醒')

    const [url, init] = fetchMock.mock.calls[1]!
    expect(String(url)).toBe('https://api.sgroup.qq.com/v2/users/openid%20%2F%20owner/messages')
    expect(JSON.parse(String(init?.body))).toEqual({ content: '喝水提醒', msg_type: 0 })
  })

  it('does not retry an uncertain active-message request', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token', expires_in: 3600 }))
      .mockRejectedValueOnce(new Error('connection closed'))

    const send = new QQApiClient('app-id', 'secret').sendC2CActiveMessage('openid-1', '喝水提醒')

    await expect(send).rejects.toMatchObject({ kind: 'unknown' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('classifies explicit QQ permission errors', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ code: 40034105, message: 'permission denied' }, 403))

    await expect(
      new QQApiClient('app-id', 'secret').sendC2CActiveMessage('openid-1', '喝水提醒')
    ).rejects.toMatchObject({
      code: 40034105,
      kind: 'rejected',
      statusCode: 403,
    })
  })
})
