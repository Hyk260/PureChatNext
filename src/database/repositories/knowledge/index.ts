import { and, eq } from 'drizzle-orm'

import { DOCUMENT_FOLDER_TYPE } from '@/const/resources/fileTypes'
import { type FileListItem, type QueryFileListParams, FilesTabs } from '@/types/files'

import { getServerDB } from '@/database/core/db-adaptor'
import { DocumentModel } from '@/database/models/document'
import { FileModel } from '@/database/models/file'
import { type DocumentItem, type FileItem, documents, files } from '@/database/schemas/file'
import { type ChatDatabase } from '@/database/type'
import { resolveFileAccessUrl } from '@/server/modules/S3/url'

export interface KnowledgeItem {
  content?: string | null
  createdAt: Date
  editorData?: Record<string, unknown> | null
  fileType: string
  id: string
  metadata?: Record<string, unknown> | null
  name: string
  parentId?: string | null
  size: number
  slug?: string | null
  sourceType: 'document' | 'file'
  updatedAt: Date
  url?: string
}

export class KnowledgeRepo {
  private readonly userId: string
  private readonly db: ChatDatabase
  private readonly fileModel: FileModel
  private readonly documentModel: DocumentModel

  constructor(userId: string, db: ChatDatabase = getServerDB()) {
    this.userId = userId
    this.db = db
    this.fileModel = new FileModel(userId, db)
    this.documentModel = new DocumentModel(userId, db)
  }

  async query(params: QueryFileListParams = {}): Promise<KnowledgeItem[]> {
    const { parentId, limit = 50, offset = 0 } = params

    let resolvedParentId = parentId
    if (parentId) {
      const docBySlug = await this.documentModel.findBySlug(parentId)
      if (docBySlug) resolvedParentId = docBySlug.id
    }

    const queryParams = { ...params, parentId: resolvedParentId, limit: limit + 1, offset }

    const [fileRows, docRows] = await Promise.all([
      this.fileModel.query(queryParams),
      params.knowledgeBaseId || params.category === FilesTabs.Documents
        ? this.documentModel.query(queryParams)
        : Promise.resolve([] as DocumentItem[]),
    ])

    const items: KnowledgeItem[] = [
      ...fileRows.map((f) => this.fileToKnowledgeItem(f)),
      ...docRows
        .filter((d) => d.fileType === DOCUMENT_FOLDER_TYPE || params.knowledgeBaseId)
        .map((d) => this.documentToKnowledgeItem(d)),
    ]

    items.sort((a, b) => {
      const field = params.sorter ?? 'createdAt'
      const dir = params.sortType === 'asc' ? 1 : -1
      const av = a[field === 'name' ? 'name' : field === 'size' ? 'size' : 'createdAt']
      const bv = b[field === 'name' ? 'name' : field === 'size' ? 'size' : 'createdAt']
      if (av instanceof Date && bv instanceof Date) return (av.getTime() - bv.getTime()) * dir
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return 0
    })

    return items.slice(0, limit + 1)
  }

  toFileListItem(item: KnowledgeItem): FileListItem {
    return {
      chunkCount: null,
      chunkingError: null,
      chunkingStatus: null,
      content: item.content,
      createdAt: item.createdAt,
      editorData: item.editorData,
      embeddingError: null,
      embeddingStatus: null,
      fileType: item.fileType,
      finishEmbedding: false,
      id: item.id,
      metadata: item.metadata,
      name: item.name,
      parentId: item.parentId,
      size: item.size,
      slug: item.slug,
      sourceType: item.sourceType,
      updatedAt: item.updatedAt,
      url: item.sourceType === 'file' && item.url ? resolveFileAccessUrl(item.id, item.url) : (item.url ?? ''),
    }
  }

  async deleteMany(items: Array<{ id: string; sourceType: 'file' | 'document' }>): Promise<void> {
    const fileIds = items.filter((item) => item.sourceType === 'file').map((item) => item.id)
    const documentIds = items.filter((item) => item.sourceType === 'document').map((item) => item.id)

    await Promise.all([
      fileIds.length > 0 ? this.fileModel.deleteMany(fileIds) : Promise.resolve(),
      documentIds.length > 0
        ? Promise.all(documentIds.map((id) => this.deleteDocumentWithRelations(id)))
        : Promise.resolve(),
    ])
  }

  private deleteDocumentWithRelations = async (id: string): Promise<void> => {
    const document = await this.documentModel.findById(id)
    if (!document) return

    if (document.fileType === DOCUMENT_FOLDER_TYPE) {
      const children = await this.db.query.documents.findMany({
        where: and(eq(documents.parentId, id), eq(documents.userId, this.userId)),
      })

      for (const child of children) {
        await this.deleteDocumentWithRelations(child.id)
      }

      const childFiles = await this.db.query.files.findMany({
        where: and(eq(files.parentId, id), eq(files.userId, this.userId)),
      })

      for (const file of childFiles) {
        await this.fileModel.delete(file.id)
      }
    }

    if (document.fileId) {
      await this.fileModel.delete(document.fileId)
    }

    await this.documentModel.delete(id)
  }

  private fileToKnowledgeItem(file: FileItem): KnowledgeItem {
    return {
      createdAt: file.createdAt,
      fileType: file.fileType,
      id: file.id,
      metadata: (file.metadata as Record<string, unknown>) ?? null,
      name: file.name,
      parentId: file.parentId,
      size: file.size,
      sourceType: 'file',
      updatedAt: file.updatedAt,
      url: file.url,
    }
  }

  private documentToKnowledgeItem(doc: DocumentItem): KnowledgeItem {
    return {
      content: doc.content,
      createdAt: doc.createdAt,
      editorData: (doc.editorData as Record<string, unknown>) ?? null,
      fileType: doc.fileType,
      id: doc.id,
      metadata: (doc.metadata as Record<string, unknown>) ?? null,
      name: doc.filename ?? doc.title ?? 'Untitled',
      parentId: doc.parentId,
      size: doc.totalCharCount,
      slug: doc.slug,
      sourceType: 'document',
      updatedAt: doc.updatedAt,
      url: doc.source,
    }
  }
}
