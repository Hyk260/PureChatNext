'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { COPIED_FEEDBACK_MS } from './channelUi'

export function useCopyFeedback(onError?: (message: string) => void) {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const copyText = useCallback(
    async (text: string, id: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopiedMessageId(id)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          setCopiedMessageId((current) => (current === id ? null : current))
        }, COPIED_FEEDBACK_MS)
      } catch {
        onError?.('复制失败，请检查浏览器剪贴板权限')
      }
    },
    [onError]
  )

  return { copiedMessageId, copyText }
}
