import { useEffect, useRef } from 'react'

type WheelDelta = { deltaX: number; deltaY: number; deltaMode: number }

export function getHorizontalWheelOffset(event: WheelDelta, current: number, max: number, pageWidth: number) {
  if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return current
  let scale = 1
  if (event.deltaMode === 1) scale = 16
  else if (event.deltaMode === 2) scale = pageWidth
  return Math.min(max, Math.max(0, current + event.deltaY * scale))
}

export function useHorizontalWheel<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const handleWheel = (event: WheelEvent) => {
      const max = element.scrollWidth - element.clientWidth
      if (max <= 0) return
      const next = getHorizontalWheelOffset(event, element.scrollLeft, max, element.clientWidth)
      if (next === element.scrollLeft) return
      event.preventDefault()
      element.scrollLeft = next
    }
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [])
  return ref
}
