'use client'

import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useResourceManagerStore } from '@/features/resources/store'
import type { FileListItem } from '@/types/files'

interface ExplorerSelectionOptions {
  data: FileListItem[]
}

export const useExplorerSelectionSummary = ({ data }: ExplorerSelectionOptions) => {
  const { selectAllState, selectedFileIds } = useResourceManagerStore(
    useShallow((s) => ({
      selectAllState: s.selectAllState,
      selectedFileIds: s.selectedFileIds,
    }))
  )

  const selectedCount = selectedFileIds.length
  const allLoadedSelected = data.length > 0 && data.every((item) => selectedFileIds.includes(item.id))
  const allSelected = allLoadedSelected
  const indeterminate = selectedCount > 0 && !allLoadedSelected

  return {
    allSelected,
    indeterminate,
    selectAllState,
    selectedCount,
    selectedFileIds,
  }
}

export const useExplorerSelectionActions = (data: FileListItem[]) => {
  const { clearSelectAllState, selectAllLoadedResources, selectedFileIds } = useResourceManagerStore(
    useShallow((s) => ({
      clearSelectAllState: s.clearSelectAllState,
      selectAllLoadedResources: s.selectAllLoadedResources,
      selectedFileIds: s.selectedFileIds,
    }))
  )

  const handleSelectAll = useCallback(
    (checked?: boolean) => {
      const allLoadedSelected = data.length > 0 && data.every((item) => selectedFileIds.includes(item.id))

      if (checked === false || allLoadedSelected) {
        clearSelectAllState()
        return
      }

      selectAllLoadedResources(data.map((item) => item.id))
    },
    [clearSelectAllState, data, selectAllLoadedResources, selectedFileIds]
  )

  const toggleItemSelection = useCallback((id: string, checked: boolean) => {
    const {
      clearSelectAllState: clear,
      selectedFileIds: current,
      setSelectedFileIds,
    } = useResourceManagerStore.getState()

    clear()

    if (checked) {
      if (current.includes(id)) return
      setSelectedFileIds([...current, id])
      return
    }

    setSelectedFileIds(current.filter((item) => item !== id))
  }, [])

  return { handleSelectAll, toggleItemSelection }
}
