'use client'

import { localStg } from '@pure/utils/storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const getChatDraftKey = (agentId: string, topicId?: string | null) => JSON.stringify([agentId, topicId ?? null])

export const EMPTY_DRAFT_FILES: File[] = []

type FilesUpdate = File[] | ((previous: File[]) => File[])

type ChatDraftState = {
  texts: Record<string, string>
  files: Record<string, File[]>
  setText: (key: string, text: string) => void
  setFiles: (key: string, update: FilesUpdate) => void
  clearDrafts: (keys: string[]) => void
}

export const useChatDraftStore = create<ChatDraftState>()(
  persist(
    (set) => ({
      texts: {},
      files: {},
      setText: (key, text) =>
        set((state) => {
          const texts = { ...state.texts }
          if (text) texts[key] = text
          else delete texts[key]
          return { texts }
        }),
      setFiles: (key, update) =>
        set((state) => {
          const next = typeof update === 'function' ? update(state.files[key] ?? EMPTY_DRAFT_FILES) : update
          const files = { ...state.files }
          if (next.length > 0) files[key] = next
          else delete files[key]
          return { files }
        }),
      clearDrafts: (keys) =>
        set((state) => {
          const texts = { ...state.texts }
          const files = { ...state.files }
          for (const key of keys) {
            delete texts[key]
            delete files[key]
          }
          return { texts, files }
        }),
    }),
    {
      name: 'purechat:chat:v1:drafts',
      storage: createJSONStorage(() => ({
        getItem: localStg.getString,
        setItem: (key, value) => {
          localStg.setString(key, value)
        },
        removeItem: (key) => {
          localStg.remove(key)
        },
      })),
      // File objects stay in memory so attachments survive topic switches without serializing their contents.
      partialize: (state) => ({ texts: state.texts }),
    }
  )
)
