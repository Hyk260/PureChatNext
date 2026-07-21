import { and, asc, count, desc, eq, ilike, inArray, isNull, or } from 'drizzle-orm'

import { DOCUMENT_FOLDER_TYPE } from '@/const/resources/fileTypes'
import { type QueryFileListParams, FilesTabs, SortType } from '@/types/files'

import { getServerDB } from '../core/db-adaptor'
import { type DocumentItem, type NewDocument, documents } from '../schemas/file'
import { type ChatDatabase } from '../type'

export class DocumentModel {
  private readonly db: ChatDatabase
  private readonly userId: string

  constructor(userId: string, db: ChatDatabase = getServerDB()) {
    this.userId = userId
    this.db = db
  }

  private ownership = () => eq(documents.userId, this.userId)

  create = async (params: Omit<NewDocument, 'userId'>): Promise<DocumentItem> => {
    const [item] = await this.db
      .insert(documents)
      .values({ ...params, userId: this.userId })
      .returning()
    return item!
  }

  findById = async (id: string) => {
    return this.db.query.documents.findFirst({
      where: and(eq(documents.id, id), this.ownership()),
    })
  }

  findBySlug = async (slug: string) => {
    return this.db.query.documents.findFirst({
      where: and(eq(documents.slug, slug), this.ownership()),
    })
  }

  update = async (
    id: string,
    data: Partial<Pick<DocumentItem, 'title' | 'filename' | 'parentId' | 'knowledgeBaseId'>>,
  ) => {
    const [item] = await this.db
      .update(documents)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(documents.id, id), this.ownership()))
      .returning()
    return item
  }

  delete = async (id: string) => {
    return this.db.delete(documents).where(and(eq(documents.id, id), this.ownership()))
  }

  createFolder = async (params: {
    knowledgeBaseId?: string
    name: string
    parentId?: string | null
  }) => {
    return this.create({
      content: '',
      fileType: DOCUMENT_FOLDER_TYPE,
      filename: params.name,
      knowledgeBaseId: params.knowledgeBaseId ?? null,
      parentId: params.parentId ?? null,
      source: '',
      sourceType: 'api',
      title: params.name,
      totalCharCount: 0,
      totalLineCount: 0,
    })
  }

  getFolderBreadcrumb = async (slugPath: string[]) => {
    const breadcrumbs: DocumentItem[] = []
    let parentId: string | null = null

    for (const slug of slugPath) {
      const folder: DocumentItem | undefined = await this.db.query.documents.findFirst({
        where: and(
          this.ownership(),
          eq(documents.fileType, DOCUMENT_FOLDER_TYPE),
          eq(documents.slug, slug),
          parentId ? eq(documents.parentId, parentId) : isNull(documents.parentId),
        ),
      })
      if (!folder) break
      breadcrumbs.push(folder)
      parentId = folder.id
    }

    return breadcrumbs
  }

  query = async (params: QueryFileListParams = {}) => {
    const {
      category,
      q,
      sortType,
      sorter,
      knowledgeBaseId,
      parentId,
      limit = 50,
      offset = 0,
    } = params

    const conditions = [this.ownership()]

    if (q) {
      conditions.push(ilike(documents.filename, `%${q}%`))
    }

    if (knowledgeBaseId) {
      conditions.push(eq(documents.knowledgeBaseId, knowledgeBaseId))
    } else {
      conditions.push(isNull(documents.knowledgeBaseId))
    }

    if (parentId === null || parentId === undefined) {
      conditions.push(isNull(documents.parentId))
    } else if (parentId) {
      conditions.push(eq(documents.parentId, parentId))
    }

    if (category === FilesTabs.Documents) {
      conditions.push(eq(documents.fileType, DOCUMENT_FOLDER_TYPE))
    }

    const sortableFields = {
      createdAt: documents.createdAt,
      name: documents.filename,
      size: documents.totalCharCount,
      updatedAt: documents.updatedAt,
    } as const

    let orderByClause = desc(documents.updatedAt)
    if (sorter && sortType && sorter in sortableFields) {
      const sortFn = sortType.toLowerCase() === SortType.Asc ? asc : desc
      orderByClause = sortFn(sortableFields[sorter as keyof typeof sortableFields])
    }

    return this.db
      .select()
      .from(documents)
      .where(and(...conditions))
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset)
  }

  queryFolders = async (knowledgeBaseId: string, parentId?: string | null) => {
    return this.db.query.documents.findMany({
      where: and(
        this.ownership(),
        eq(documents.knowledgeBaseId, knowledgeBaseId),
        eq(documents.fileType, DOCUMENT_FOLDER_TYPE),
        parentId ? eq(documents.parentId, parentId) : isNull(documents.parentId),
      ),
      orderBy: [desc(documents.updatedAt)],
    })
  }
}
