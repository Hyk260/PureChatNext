import type { ServiceModelSettings, ServiceModelSettingsPatch } from '@pure/types'
import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'

import { useSession } from '@/libs/better-auth/client'
import { apiFetch, jsonInit } from '@/utils/apiFetch'

const SETTINGS_URL = '/api/user/service-model-settings'

export async function fetchServiceModelSettings(): Promise<ServiceModelSettings> {
  const response = await apiFetch(SETTINGS_URL)
  const body = (await response.json().catch(() => ({}))) as { error?: string; settings?: ServiceModelSettings }
  if (!response.ok) throw new Error(body.error || '读取服务模型设置失败')
  return body.settings ?? {}
}

async function updateServiceModelSettings(patch?: ServiceModelSettingsPatch): Promise<ServiceModelSettings> {
  const response = await apiFetch(
    SETTINGS_URL,
    patch ? jsonInit(patch, { method: 'PATCH' }) : { method: 'DELETE' }
  )
  const body = (await response.json().catch(() => ({}))) as { error?: string; settings?: ServiceModelSettings }
  if (!response.ok) throw new Error(body.error || '保存服务模型设置失败')
  return body.settings ?? {}
}

export function useServiceModelSettings() {
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
  const swr = useSWR(userId ? [SETTINGS_URL, userId] : null, fetchServiceModelSettings, {
    revalidateOnFocus: false,
  })
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const [saving, setSaving] = useState(false)
  const pending = useRef(0)

  const enqueue = (operation: () => Promise<ServiceModelSettings>) => {
    pending.current++
    setSaving(true)
    const task = queue.current
      .catch(() => {})
      .then(async () => {
        assertOwner()
        const settings = await operation()
        assertOwner()
        await swr.mutate(settings, { revalidate: false })
        return settings
      })
      .finally(() => {
        pending.current--
        setSaving(pending.current > 0)
      })
    queue.current = task
    return task
  }

  return {
    ...swr,
    reset: () => enqueue(() => updateServiceModelSettings()),
    save: (patch: ServiceModelSettingsPatch) => enqueue(() => updateServiceModelSettings(patch)),
    saving,
  }
}
