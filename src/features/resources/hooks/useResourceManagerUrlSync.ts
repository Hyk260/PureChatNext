'use client'

import { useEffect, useRef } from 'react'
import { useQueryState } from 'nuqs'
import { useShallow } from 'zustand/react/shallow'

import { useResourceManagerStore } from '@/features/resources/store'
import { SortType } from '@/types/files'

/**
 * Store 为排序状态源，URL 仅用于书签同步。
 * 挂载时只做一次 URL → Store，避免与 Store → URL 形成循环，
 * 防止 nuqs 在组件尚未 commit 时触发异步 setState。
 */
export const useResourceManagerUrlSync = () => {
  const [sorterParam, setSorterParam] = useQueryState('sorter')
  const [sortTypeParam, setSortTypeParam] = useQueryState('sortType')
  const { setSortType, setSorter, sortType, sorter } = useResourceManagerStore(
    useShallow((s) => ({
      setSortType: s.setSortType,
      setSorter: s.setSorter,
      sortType: s.sortType,
      sorter: s.sorter,
    }))
  )

  const skipUrlSyncRef = useRef(true)

  // URL → Store（仅挂载时）
  useEffect(() => {
    if (sorterParam) {
      setSorter(sorterParam as 'createdAt' | 'name' | 'size')
    }
    if (sortTypeParam) {
      setSortType(sortTypeParam as SortType)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only hydrate
  }, [])

  // Store → URL（跳过首次，避免用默认值覆盖 URL）
  useEffect(() => {
    if (skipUrlSyncRef.current) {
      skipUrlSyncRef.current = false
      return
    }

    const nextSorter = sorter === 'createdAt' ? null : sorter
    const nextSortType = sortType === SortType.Desc ? null : sortType

    if (sorterParam !== nextSorter) setSorterParam(nextSorter)
    if (sortTypeParam !== nextSortType) setSortTypeParam(nextSortType)
  }, [sorter, sortType, sorterParam, sortTypeParam, setSorterParam, setSortTypeParam])
}
