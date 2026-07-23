'use client'

import { useEffect } from 'react'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

import { type FileListItem, type QueryFileListParams } from '@/types/files'
import { type KnowledgeBaseListItem } from '@/types/resource'

import { resourceService } from '@/services/resource'

interface ResourceStoreState {
  hasMore: boolean
  isLoading: boolean
  knowledgeBases: KnowledgeBaseListItem[]
  queryParams: QueryFileListParams | null
  resourceList: FileListItem[]
  setKnowledgeBases: (items: KnowledgeBaseListItem[]) => void
  setQueryParams: (params: QueryFileListParams | null) => void
  setResourceList: (items: FileListItem[], hasMore: boolean) => void
  setLoading: (loading: boolean) => void
  removeResourcesOptimistically: (ids: string[]) => void
  fetchResources: (params: QueryFileListParams) => Promise<void>
  fetchKnowledgeBases: () => Promise<void>
  createKnowledgeBase: (name: string) => Promise<KnowledgeBaseListItem>
  deleteKnowledgeBase: (id: string) => Promise<void>
  batchDelete: (items: Array<{ id: string; sourceType: 'file' | 'document' }>) => Promise<void>
}

export const useResourceStore = create<ResourceStoreState>()(
  devtools((set, get) => ({
    hasMore: false,
    isLoading: false,
    knowledgeBases: [],
    queryParams: null,
    resourceList: [],
    setKnowledgeBases: (knowledgeBases) => set({ knowledgeBases }),
    setQueryParams: (queryParams) => set({ queryParams }),
    setResourceList: (resourceList, hasMore) => set({ resourceList, hasMore }),
    setLoading: (isLoading) => set({ isLoading }),
    removeResourcesOptimistically: (ids) =>
      set((state) => ({
        resourceList: state.resourceList.filter((item) => !ids.includes(item.id)),
      })),
    fetchResources: async (params) => {
      set({ isLoading: true, queryParams: params })
      try {
        const result = await resourceService.getKnowledgeItems(params)
        set({ hasMore: result.hasMore, isLoading: false, resourceList: result.items })
      } catch {
        set({ isLoading: false })
      }
    },
    fetchKnowledgeBases: async () => {
      try {
        const items = await resourceService.getKnowledgeBases()
        set({ knowledgeBases: items })
      } catch {
        set({ knowledgeBases: [] })
      }
    },
    createKnowledgeBase: async (name) => {
      const item = await resourceService.createKnowledgeBase({ name })
      set((state) => ({ knowledgeBases: [item, ...state.knowledgeBases] }))
      return item
    },
    deleteKnowledgeBase: async (id) => {
      await resourceService.deleteKnowledgeBase(id)
      set((state) => ({ knowledgeBases: state.knowledgeBases.filter((kb) => kb.id !== id) }))
    },
    batchDelete: async (items) => {
      get().removeResourcesOptimistically(items.map((item) => item.id))
      await resourceService.batchDelete(items)
    },
  }))
)

export const useFetchResources = (params: QueryFileListParams) => {
  const fetchResources = useResourceStore((s) => s.fetchResources)
  const isLoading = useResourceStore((s) => s.isLoading)
  const key = JSON.stringify(params)

  useEffect(() => {
    fetchResources(JSON.parse(key) as QueryFileListParams)
  }, [fetchResources, key])

  return { isLoading, isValidating: isLoading }
}

export const useFetchKnowledgeBaseList = () => {
  const fetchKnowledgeBases = useResourceStore((s) => s.fetchKnowledgeBases)
  const knowledgeBases = useResourceStore((s) => s.knowledgeBases)

  useEffect(() => {
    fetchKnowledgeBases()
  }, [fetchKnowledgeBases])

  return { data: knowledgeBases, isLoading: false }
}

export const revalidateResources = () => {
  const { queryParams, fetchResources } = useResourceStore.getState()
  if (queryParams) fetchResources(queryParams)
}
