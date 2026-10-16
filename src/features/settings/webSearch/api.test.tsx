import { act, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { SWRConfig } from 'swr'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/libs/better-auth/client', () => ({ useSession: () => ({ data: { user: { id: 'owner' } } }) }))

import { useWebSearchSettings } from './api'

afterEach(() => vi.unstubAllGlobals())

describe('settings persistence', () => {
  it('cancels queued credential saves after the owning settings session unmounts', async () => {
    let release: () => void = () => {}
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    let patches = 0
    const response = { settings: {}, server: { searchProviders: [], fetchProviders: [], providers: {} } }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          patches++
          await pending
        }
        return Response.json(response)
      })
    )
    const cache = new Map()
    const wrapper = ({ children }: PropsWithChildren) => (
      <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>
    )
    const { result, unmount } = renderHook(useWebSearchSettings, { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    let first: Promise<unknown>
    let second: Promise<unknown>
    act(() => {
      first = result.current.save({ maxResults: 7 }).catch((error: Error) => error.message)
      second = result.current
        .save({ providers: { exa: { apiKeys: ['owner-key'] } } })
        .catch((error: Error) => error.message)
    })
    await waitFor(() => expect(patches).toBe(1))
    unmount()
    release()
    expect(await first!).toBe('账号已切换，请重新操作')
    expect(await second!).toBe('账号已切换，请重新操作')
    expect(patches).toBe(1)
  })

  it('serializes field saves, surfaces failures, and keeps the following update usable', async () => {
    const patches: unknown[] = []
    let release: () => void = () => {}
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const server = { searchProviders: ['exa'], fetchProviders: ['naive'], providers: {} }
    const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method !== 'PATCH') return Response.json({ settings: {}, server })
      patches.push(JSON.parse(String(init.body)))
      if (patches.length === 1) {
        await pending
        return Response.json({ error: '保存失败' }, { status: 503 })
      }
      return Response.json({ settings: { maxResults: 8 }, server })
    })
    vi.stubGlobal('fetch', fetch)
    const cache = new Map()
    const wrapper = ({ children }: PropsWithChildren) => (
      <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>{children}</SWRConfig>
    )
    const { result } = renderHook(useWebSearchSettings, { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    let failed: Promise<unknown>
    let following: Promise<unknown>
    act(() => {
      failed = result.current.save({ compression: 'none' }).catch((error: Error) => error.message)
      following = result.current.save({ maxResults: 8 })
    })
    await waitFor(() => expect(patches).toHaveLength(1))
    expect(result.current.saving).toBe(true)
    await act(async () => {
      release()
      expect(await failed!).toBe('保存失败')
      await following!
    })
    expect(patches).toEqual([{ compression: 'none' }, { maxResults: 8 }])
    expect(result.current.data?.settings.maxResults).toBe(8)
    expect(result.current.saving).toBe(false)
  })
})
