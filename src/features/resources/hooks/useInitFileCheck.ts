'use client'

import { useEffect } from 'react'
import { useQueryState } from 'nuqs'
import { useShallow } from 'zustand/react/shallow'

import { useResourceManagerStore } from '@/features/resources/store'

export const useInitFileCheck = () => {
  const [fileParam] = useQueryState('file')
  const { currentViewItemId, mode, setCurrentViewItemId, setMode } = useResourceManagerStore(
    useShallow((s) => ({
      currentViewItemId: s.currentViewItemId,
      mode: s.mode,
      setCurrentViewItemId: s.setCurrentViewItemId,
      setMode: s.setMode,
    })),
  )

  useEffect(() => {
    if (fileParam) {
      if (currentViewItemId !== fileParam) setCurrentViewItemId(fileParam)
      if (mode !== 'editor') setMode('editor')
      return
    }

    if (currentViewItemId) setCurrentViewItemId(undefined)
    if (mode !== 'explorer') setMode('explorer')
  }, [fileParam, currentViewItemId, mode, setCurrentViewItemId, setMode])
}
