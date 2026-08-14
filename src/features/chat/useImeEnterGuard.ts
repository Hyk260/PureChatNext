import { useCallback, useRef } from 'react'
import type { CompositionEvent, KeyboardEvent } from 'react'

/**
 * 中文等 IME 组字时，Enter 用于上屏候选词，不能当发送。
 * 部分浏览器会在 compositionend 之后立刻再派发一次 isComposing=false 的 Enter。
 */
export function useImeEnterGuard() {
  const composingRef = useRef(false)
  const skipNextEnterRef = useRef(false)

  const onCompositionStart = useCallback((_event?: CompositionEvent<HTMLTextAreaElement>) => {
    composingRef.current = true
  }, [])

  const onCompositionEnd = useCallback((_event?: CompositionEvent<HTMLTextAreaElement>) => {
    composingRef.current = false
    skipNextEnterRef.current = true
    requestAnimationFrame(() => {
      skipNextEnterRef.current = false
    })
  }, [])

  const shouldIgnoreEnter = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    const native = event.nativeEvent
    return native.isComposing || native.keyCode === 229 || composingRef.current || skipNextEnterRef.current
  }, [])

  return { onCompositionEnd, onCompositionStart, shouldIgnoreEnter }
}
