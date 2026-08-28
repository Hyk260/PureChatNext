'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export type ShapeVariant = 'pill' | 'rounded'

export interface ShapeClasses {
  bg: string
  bgRadius: number
  button: string
  container: string
  focusRing: string
  input: string
  item: string
  mergedBg: string
  mergedRadius: number
}

interface ShapeContextValue {
  classes: ShapeClasses
  setShape: (shape: ShapeVariant) => void
  shape: ShapeVariant
}

export const shapeMap: Record<ShapeVariant, ShapeClasses> = {
  pill: {
    bg: 'rounded-[20px]',
    bgRadius: 20,
    button: 'rounded-[20px]',
    container: 'rounded-3xl',
    focusRing: 'rounded-[22px]',
    input: 'rounded-[20px]',
    item: 'rounded-[20px]',
    mergedBg: 'rounded-2xl',
    mergedRadius: 16,
  },
  rounded: {
    bg: 'rounded-lg',
    bgRadius: 8,
    button: 'rounded-lg',
    container: 'rounded-xl',
    focusRing: 'rounded-[10px]',
    input: 'rounded-lg',
    item: 'rounded-lg',
    mergedBg: 'rounded-lg',
    mergedRadius: 8,
  },
}

const ShapeContext = createContext<ShapeContextValue | null>(null)

export function useShape(): ShapeClasses {
  const ctx = useContext(ShapeContext)
  if (!ctx) return shapeMap.pill
  return ctx.classes
}

export function useShapeContext() {
  const ctx = useContext(ShapeContext)
  if (!ctx) throw new Error('useShapeContext must be used within a ShapeProvider')
  return ctx
}

export function ShapeProvider({
  children,
  defaultShape = 'pill',
}: {
  children: ReactNode
  defaultShape?: ShapeVariant
}) {
  const [shape, setShapeState] = useState<ShapeVariant>(defaultShape)
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const transitionShape = useCallback((callback: () => void) => {
    const root = document.documentElement
    root.classList.add('transitioning')
    void root.offsetHeight
    callback()
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current)
    transitionTimeoutRef.current = setTimeout(() => root.classList.remove('transitioning'), 200)
  }, [])

  const setShape = useCallback(
    (next: ShapeVariant) => {
      transitionShape(() => setShapeState(next))
    },
    [transitionShape],
  )

  useEffect(() => {
    document.documentElement.style.setProperty('--shape-input-radius', `${shapeMap[shape].bgRadius}px`)
  }, [shape])

  const value = useMemo(() => ({ classes: shapeMap[shape], setShape, shape }), [shape, setShape])

  return <ShapeContext.Provider value={value}>{children}</ShapeContext.Provider>
}
