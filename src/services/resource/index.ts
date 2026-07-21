import { type FileListItem, type PaginatedFileList, type QueryFileListParams } from '@/types/files'
import { type KnowledgeBaseListItem } from '@/types/resource'
import { apiFetch } from '@/utils/apiFetch'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? res.statusText)
  }

  return res.json() as Promise<T>
}

function toSearchParams(params: QueryFileListParams) {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null) continue
    sp.set(key, String(value))
  }
  return sp.toString()
}

export const resourceService = {
  getKnowledgeItems: (params: QueryFileListParams = {}) =>
    fetchJson<PaginatedFileList>(`/api/resources/items?${toSearchParams(params)}`),

  uploadFile: async (file: File, options?: { knowledgeBaseId?: string; parentId?: string }) => {
    const formData = new FormData()
    formData.append('file', file)
    if (options?.knowledgeBaseId) formData.append('knowledgeBaseId', options.knowledgeBaseId)
    if (options?.parentId) formData.append('parentId', options.parentId)

    const res = await apiFetch('/api/resources/upload', {
      body: formData,
      method: 'POST',
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? res.statusText)
    }

    return res.json()
  },

  deleteFile: (id: string) =>
    fetchJson<{ success: boolean }>(`/api/resources/files/${id}`, { method: 'DELETE' }),

  batchDelete: (items: Array<{ id: string; sourceType: 'file' | 'document' }>) =>
    fetchJson<{ deleted: number }>(`/api/resources/files/batch`, {
      body: JSON.stringify({ action: 'delete', items }),
      method: 'POST',
    }),

  updateFile: (id: string, data: { name?: string; parentId?: string | null }) =>
    fetchJson<FileListItem>(`/api/resources/files/${id}`, {
      body: JSON.stringify(data),
      method: 'PATCH',
    }),

  getKnowledgeBases: () => fetchJson<KnowledgeBaseListItem[]>('/api/resources/knowledge-bases'),

  createKnowledgeBase: (data: { name: string; description?: string }) =>
    fetchJson<KnowledgeBaseListItem>('/api/resources/knowledge-bases', {
      body: JSON.stringify(data),
      method: 'POST',
    }),

  updateKnowledgeBase: (id: string, data: { name?: string; description?: string }) =>
    fetchJson<KnowledgeBaseListItem>(`/api/resources/knowledge-bases/${id}`, {
      body: JSON.stringify(data),
      method: 'PATCH',
    }),

  deleteKnowledgeBase: (id: string) =>
    fetchJson<{ success: boolean }>(`/api/resources/knowledge-bases/${id}`, { method: 'DELETE' }),

  addFilesToKnowledgeBase: (id: string, fileIds: string[]) =>
    fetchJson<{ success: boolean }>(`/api/resources/knowledge-bases/${id}/files`, {
      body: JSON.stringify({ action: 'add', fileIds }),
      method: 'POST',
    }),

  removeFilesFromKnowledgeBase: (id: string, fileIds: string[]) =>
    fetchJson<{ success: boolean }>(`/api/resources/knowledge-bases/${id}/files`, {
      body: JSON.stringify({ action: 'remove', fileIds }),
      method: 'POST',
    }),

  createFolder: (data: { name: string; knowledgeBaseId?: string; parentId?: string | null }) =>
    fetchJson<{ id: string; slug: string | null }>('/api/resources/documents/folder', {
      body: JSON.stringify(data),
      method: 'POST',
    }),

  getFolderBreadcrumb: (slugPath: string) =>
    fetchJson<Array<{ id: string; slug: string | null; title: string | null }>>(
      `/api/resources/documents/breadcrumb?slugPath=${encodeURIComponent(slugPath)}`,
    ),
}
