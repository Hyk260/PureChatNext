'use client'

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

import type { ResourceManagerMode } from '@/features/resources/ResourceManager'
import {
  FILE_DATE_WIDTH,
  FILE_NAME_DEFAULT_WIDTH,
  FILE_SIZE_WIDTH,
} from '@/features/resources/ResourceManager/components/Explorer/ListView/constants'
import { FilesTabs, SortType } from '@/types/files'

export type ViewMode = 'list' | 'masonry'
export type SelectAllState = 'all' | 'loaded' | 'none'

export interface ColumnWidths {
  date: number
  name: number
  size: number
}

export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  date: FILE_DATE_WIDTH,
  name: FILE_NAME_DEFAULT_WIDTH,
  size: FILE_SIZE_WIDTH,
}

export interface ResourceManagerState {
  category: FilesTabs
  columnWidths: ColumnWidths
  currentViewItemId?: string
  libraryId?: string
  mode: ResourceManagerMode
  pendingRenameItemId: string | null
  searchQuery: string | null
  selectAllState: SelectAllState
  selectedFileIds: string[]
  sorter: 'createdAt' | 'name' | 'size'
  sortType: SortType
  viewMode: ViewMode
  setCategory: (category: FilesTabs) => void
  setCurrentViewItemId: (id?: string) => void
  setLibraryId: (id?: string) => void
  setMode: (mode: ResourceManagerMode) => void
  setPendingRenameItemId: (id: string | null) => void
  setSearchQuery: (query: string | null) => void
  setSelectedFileIds: (ids: string[]) => void
  setSelectAllState: (state: SelectAllState) => void
  setSorter: (sorter: 'createdAt' | 'name' | 'size') => void
  setSortType: (sortType: SortType) => void
  setViewMode: (mode: ViewMode) => void
  updateColumnWidth: (column: keyof ColumnWidths, width: number) => void
  toggleSelectFile: (id: string) => void
  clearSelection: () => void
  clearSelectAllState: () => void
  selectAllLoadedResources: (ids: string[]) => void
}

export const useResourceManagerStore = create<ResourceManagerState>()(
  devtools((set, get) => ({
    category: FilesTabs.All,
    columnWidths: DEFAULT_COLUMN_WIDTHS,
    currentViewItemId: undefined,
    libraryId: undefined,
    mode: 'explorer',
    pendingRenameItemId: null,
    searchQuery: null,
    selectAllState: 'none',
    selectedFileIds: [],
    sortType: SortType.Desc,
    sorter: 'createdAt',
    viewMode: 'list',
    setCategory: (category) => set({ category }),
    setCurrentViewItemId: (currentViewItemId) => set({ currentViewItemId }),
    setLibraryId: (libraryId) => set({ libraryId }),
    setMode: (mode) => set({ mode }),
    setPendingRenameItemId: (pendingRenameItemId) => set({ pendingRenameItemId }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setSelectedFileIds: (selectedFileIds) => set({ selectedFileIds }),
    setSelectAllState: (selectAllState) => set({ selectAllState }),
    setSorter: (sorter) => set({ sorter }),
    setSortType: (sortType) => set({ sortType }),
    setViewMode: (viewMode) => set({ viewMode }),
    updateColumnWidth: (column, width) =>
      set((state) => ({
        columnWidths: { ...state.columnWidths, [column]: width },
      })),
    toggleSelectFile: (id) => {
      const { selectedFileIds } = get()
      set({
        selectAllState: 'none',
        selectedFileIds: selectedFileIds.includes(id)
          ? selectedFileIds.filter((item) => item !== id)
          : [...selectedFileIds, id],
      })
    },
    clearSelection: () => set({ selectAllState: 'none', selectedFileIds: [] }),
    clearSelectAllState: () => set({ selectAllState: 'none', selectedFileIds: [] }),
    selectAllLoadedResources: (ids) => set({ selectAllState: 'loaded', selectedFileIds: ids }),
  })),
)
