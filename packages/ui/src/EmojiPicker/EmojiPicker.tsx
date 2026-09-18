'use client'

import { EmojiPicker as LobeEmojiPicker } from '@lobehub/ui'
import type { EmojiPickerProps } from '@lobehub/ui'
import { memo, useCallback, useEffect, useState } from 'react'

const PICKER_BOOTING_CLASS =
  "min-h-[435px] after:pointer-events-none after:absolute after:top-1/2 after:left-1/2 after:z-10 after:block after:size-6 after:-translate-x-1/2 after:-translate-y-1/2 after:animate-spin after:rounded-full after:border-2 after:border-border after:border-t-primary after:content-['']"

const PICKER_PAINT_TIMEOUT_MS = 4000

function isEmojiPickerPainted() {
  const el = document.querySelector('em-emoji-picker')
  if (!el?.shadowRoot) return false
  for (const child of el.shadowRoot.children) {
    if (child.tagName !== 'STYLE') return true
  }
  return false
}

export const EmojiPicker = memo<EmojiPickerProps>(({ defaultOpen, onOpenChange, open, popupClassName, ...rest }) => {
  const [booted, setBooted] = useState(false)
  const [waiting, setWaiting] = useState(() => Boolean(open || defaultOpen))

  const handleOpenChange = useCallback(
    (open: boolean) => {
      onOpenChange?.(open)
      if (!open || booted) {
        setWaiting(false)
        return
      }
      setWaiting(true)
    },
    [booted, onOpenChange],
  )

  useEffect(() => {
    if (!waiting) return

    const started = Date.now()
    let cancelled = false
    let frame = 0

    const tick = () => {
      if (cancelled) return
      if (isEmojiPickerPainted() || Date.now() - started > PICKER_PAINT_TIMEOUT_MS) {
        setBooted(true)
        setWaiting(false)
        return
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [waiting])

  const mergedPopupClassName = [popupClassName, !booted && PICKER_BOOTING_CLASS].filter(Boolean).join(' ')

  return (
    <LobeEmojiPicker
      {...rest}
      defaultOpen={defaultOpen}
      open={open}
      popupClassName={mergedPopupClassName || undefined}
      onOpenChange={handleOpenChange}
    />
  )
})

EmojiPicker.displayName = 'EmojiPicker'
