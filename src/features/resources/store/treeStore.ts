'use client'

import { create } from 'zustand'

export interface TreeItem {
  children?: TreeItem[]
  id: string
  name: string
  slug?: string | null
}

interface TreeStoreState {
  children: Record<string, TreeItem[]>
  expanded: Record<string, boolean>
  init: (libraryId: string, items: TreeItem[]) => void
  toggle: (id: string) => void
  expandAncestors: (ids: string[]) => void
}

export const useTreeStore = create<TreeStoreState>((set, get) => ({
  children: {},
  expanded: {},
  init: (libraryId, items) => {
    set((state) => ({
      children: { ...state.children, [libraryId]: items },
    }))
  },
  toggle: (id) => {
    set((state) => ({
      expanded: { ...state.expanded, [id]: !state.expanded[id] },
    }))
  },
  expandAncestors: (ids) => {
    set((state) => {
      const expanded = { ...state.expanded }
      for (const id of ids) expanded[id] = true
      return { expanded }
    })
  },
}))

export const treeSelectors = {
  getChildren: (libraryId: string) => (state: TreeStoreState) => state.children[libraryId] ?? [],
  isExpanded: (id: string) => (state: TreeStoreState) => Boolean(state.expanded[id]),
}
