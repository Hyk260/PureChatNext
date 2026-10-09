'use client'

import { useCallback, useEffect, useState } from 'react'

import { getDesktopApi } from '@/types/desktop'
import { isDesktopRenderer } from '@/utils/desktopAuth'

export type DesktopSession = {
  session: {
    expiresAt: Date
    id: string
    userId: string
  }
  user: {
    email: string
    id: string
    image?: string | null
    name: string
    role?: string | null
  }
}

type DesktopMeResponse = {
  data?: {
    avatar?: string | null
    email?: string | null
    fullName?: string | null
    id?: string
    role?: string | null
  }
}

export const useDesktopSession = () => {
  const api = getDesktopApi()
  const [data, setData] = useState<DesktopSession | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isPending, setIsPending] = useState(true)

  const refetch = useCallback(async () => {
    if (!isDesktopRenderer()) return
    setIsPending(true)
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' })
      if (response.status === 401) {
        setData(null)
        setError(null)
        return
      }
      if (!response.ok) throw new Error('加载桌面会话失败')
      const body = (await response.json()) as DesktopMeResponse
      const user = body.data
      if (!user?.id || !user.email) throw new Error('桌面会话数据无效')
      setData({
        session: {
          expiresAt: new Date(Date.now() + 900_000),
          id: 'desktop-session',
          userId: user.id,
        },
        user: {
          email: user.email,
          id: user.id,
          image: user.avatar,
          name: user.fullName || user.email.split('@')[0],
          role: user.role,
        },
      })
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('加载桌面会话失败'))
      setData(null)
    } finally {
      setIsPending(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(refetch, 0)
    if (!api || !isDesktopRenderer()) {
      return () => window.clearTimeout(timer)
    }
    const unsubscribe = api.auth.onStatusChange(() => {
      window.setTimeout(refetch, 0)
    })
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [api, refetch])

  return { data, error, isPending, refetch }
}
