import type { WebCapability, WebProviderId, WebSearchSettingsPatch, WebSearchSettingsResponse } from '@pure/types'
import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'

import { useSession } from '@/libs/better-auth/client'
import { apiFetch, jsonInit } from '@/utils/apiFetch'

const SETTINGS_URL = '/api/user/web-search-settings'

async function settingsRequest(init?: RequestInit): Promise<WebSearchSettingsResponse> {
  const response = await apiFetch(SETTINGS_URL, init)
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || '网络搜索设置请求失败')
  return body
}

export function useWebSearchSettings() {
  const { data: session } = useSession()
  const userId = session?.user.id
  const owner = useRef(userId)
  useEffect(() => {
    owner.current = userId
    return () => {
      owner.current = undefined
    }
  }, [userId])
  const assertOwner = () => {
    if (!userId || owner.current !== userId) throw new Error('账号已切换，请重新操作')
  }
  const swr = useSWR(session?.user.id ? [SETTINGS_URL, session.user.id] : null, () => settingsRequest(), {
    revalidateOnFocus: false,
  })
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const [saving, setSaving] = useState(false)
  const pending = useRef(0)
  const save = (patch: WebSearchSettingsPatch) => {
    pending.current++
    setSaving(true)
    const task = queue.current
      .catch(() => {})
      .then(async () => {
        assertOwner()
        const data = await settingsRequest(jsonInit(patch, { method: 'PATCH' }))
        assertOwner()
        await swr.mutate(data, { revalidate: false })
        return data
      })
      .finally(() => {
        pending.current--
        setSaving(pending.current > 0)
      })
    queue.current = task
    return task
  }
  const reset = async () => {
    await queue.current.catch(() => {})
    assertOwner()
    const data = await settingsRequest({ method: 'DELETE' })
    assertOwner()
    await swr.mutate(data, { revalidate: false })
  }
  return { ...swr, save, reset, saving }
}

export async function checkWebProvider(capability: WebCapability, provider: WebProviderId) {
  const response = await apiFetch('/api/user/web-search/check', jsonInit({ capability, provider }, { method: 'POST' }))
  const body = (await response.json()) as { success: boolean; durationMs: number; message: string; error?: string }
  if (!response.ok) throw new Error(body.error || '检测失败')
  return body
}
