import { type FileListItem, type QueryFileListParams } from './files'

export type ResourceItem = FileListItem

export type ResourceQueryParams = QueryFileListParams

export interface KnowledgeBaseListItem {
  avatar?: string | null
  createdAt: Date
  description?: string | null
  id: string
  name: string
  type?: string | null
  updatedAt: Date
}
