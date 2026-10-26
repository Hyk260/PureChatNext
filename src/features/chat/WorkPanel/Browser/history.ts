import { localStg } from '@pure/utils/storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { isBrowserUrl } from '@/utils/browserUrl'

export interface BrowserHistoryItem {
  url: string
  title: string
}

export const MAX_BROWSER_HISTORY = 5
export const EMPTY_BROWSER_HISTORY: BrowserHistoryItem[] = []

export function rememberBrowserVisit(history: BrowserHistoryItem[], item: BrowserHistoryItem) {
  if (item.url === 'about:blank' || !isBrowserUrl(item.url)) return history
  const url = new URL(item.url).href
  const previous = history.find((entry) => entry.url === url)
  const title = item.title.trim().slice(0, 500) || previous?.title || url
  return [{ url, title }, ...history.filter((entry) => entry.url !== url)].slice(0, MAX_BROWSER_HISTORY)
}

export function filterBrowserHistory(history: BrowserHistoryItem[], query: string) {
  const search = query.trim().toLocaleLowerCase()
  return history.filter((item) => `${item.title}\n${item.url}`.toLocaleLowerCase().includes(search))
}

interface BrowserHistoryStore {
  byScope: Record<string, BrowserHistoryItem[]>
  remember: (scope: string, item: BrowserHistoryItem) => void
}

export const useBrowserHistoryStore = create<BrowserHistoryStore>()(
  persist(
    (set) => ({
      byScope: {},
      remember: (scope, item) =>
        set((state) => ({
          byScope: {
            ...state.byScope,
            [scope]: rememberBrowserVisit(state.byScope[scope] ?? EMPTY_BROWSER_HISTORY, item),
          },
        })),
    }),
    {
      name: 'purechat:browser:v1:history',
      storage: createJSONStorage(() => ({
        getItem: localStg.getString,
        setItem: (key, value) => {
          localStg.setString(key, value)
        },
        removeItem: (key) => {
          localStg.remove(key)
        },
      })),
      partialize: (state) => ({ byScope: state.byScope }),
    }
  )
)
