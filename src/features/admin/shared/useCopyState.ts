'use client'

import { useEffect, useRef, useState } from 'react'

import { COPY_FEEDBACK_MS } from './diagnosticState'
import type { CopyState } from './diagnosticState'

export function useCopyState() {
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach(clearTimeout)
      pending.clear()
    }
  }, [])

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
      const timer = setTimeout(() => {
        timers.current.delete(timer)
        setCopyState('idle')
      }, COPY_FEEDBACK_MS)
      timers.current.add(timer)
    } catch {
      setCopyState('failed')
    }
  }

  return { copyState, copyText, setCopyState }
}
