'use client'

import { useEffect, useState } from 'react'

export const useSystemAppearance = (): 'light' | 'dark' => {
  const [appearance, setAppearance] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => setAppearance(media.matches ? 'dark' : 'light')

    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return appearance
}
