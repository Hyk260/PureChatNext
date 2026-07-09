import { z } from 'zod'

export enum FilesTabs {
  All = 'all',
  Audios = 'audios',
  Documents = 'documents',
  Home = 'home',
  Images = 'images',
  Pages = 'pages',
  Videos = 'videos',
  Websites = 'websites',
}

export enum FileSource {
  ImageGeneration = 'image_generation',
  PageEditor = 'page-editor',
  VideoGeneration = 'video_generation',
}

export enum SortType {
  Asc = 'asc',
  Desc = 'desc',
}

export interface FileListItem {
  chunkCount: number | null
  chunkingError: unknown | null
  chunkingStatus?: string | null
  content?: string | null
  createdAt: Date
  editorData?: Record<string, unknown> | null
  embeddingError: unknown | null
  embeddingStatus?: string | null
  fileType: string
  finishEmbedding: boolean
  id: string
  metadata?: Record<string, unknown> | null
  name: string
  parentId?: string | null
  size: number
  slug?: string | null
  sourceType: string
  updatedAt: Date
  url: string
  userId?: string
}

export const QueryFileListSchema = z.object({
  category: z.string().optional(),
  knowledgeBaseId: z.string().optional(),
  limit: z.coerce.number().int().positive().default(50),
  offset: z.coerce.number().int().min(0).default(0),
  parentId: z.string().nullable().optional(),
  q: z.string().nullable().optional(),
  showFilesInKnowledgeBase: z.coerce.boolean().default(false),
  sortType: z.enum(['desc', 'asc']).optional(),
  sorter: z.enum(['createdAt', 'size', 'name']).optional(),
})

export type QueryFileListSchemaType = z.infer<typeof QueryFileListSchema>

export interface QueryFileListParams {
  category?: string
  knowledgeBaseId?: string
  limit?: number
  offset?: number
  parentId?: string | null
  q?: string | null
  showFilesInKnowledgeBase?: boolean
  sorter?: string
  sortType?: string
}

export interface PaginatedFileList {
  hasMore: boolean
  items: FileListItem[]
  total?: number
}
