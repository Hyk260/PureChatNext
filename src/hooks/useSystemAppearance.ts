'use client'

import { useEffect, useState } from 'react'

const getSystemAppearance = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light'

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useSystemAppearance = (): 'light' | 'dark' => {
  const [appearance, setAppearance] = useState<'light' | 'dark'>(getSystemAppearance)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => setAppearance(media.matches ? 'dark' : 'light')

    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return appearance
}
