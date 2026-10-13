// @vitest-environment node
import type { AxiosAdapter } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as urlBuilder from './buildURL'
import { http } from './rest-api'

beforeEach(() => {
  vi.spyOn(urlBuilder, 'buildURL').mockReturnValue('/test')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('IM HTTP response handling', () => {
  it('returns typed response data through the real Axios interceptor chain', async () => {
    const data = { ActionStatus: 'OK', ErrorCode: 0, ErrorInfo: '' }
    const adapter = vi.fn<AxiosAdapter>(async (config) => ({
      config,
      data,
      headers: {},
      status: 200,
      statusText: 'OK',
    }))

    await expect(http.request<typeof data>({ adapter, url: '/account', data: { id: 'user' } })).resolves.toEqual(data)
    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({ method: 'post', url: '/test' }))
    expect(urlBuilder.buildURL).toHaveBeenCalledWith('/account')
  })

  it('still rejects non-200 responses with their original payload', async () => {
    const data = { ErrorInfo: 'unexpected response' }
    const adapter: AxiosAdapter = async (config) => ({
      config,
      data,
      headers: {},
      status: 201,
      statusText: 'Created',
    })

    await expect(http.request({ adapter, url: '/account' })).rejects.toBe(data)
  })

  it('preserves adapter errors', async () => {
    const error = new Error('network unavailable')
    const adapter: AxiosAdapter = async () => {
      throw error
    }

    await expect(http.request({ adapter, url: '/account' })).rejects.toBe(error)
  })
})
