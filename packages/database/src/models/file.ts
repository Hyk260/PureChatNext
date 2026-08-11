import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sum } from 'drizzle-orm'

import { FilesTabs, SortType } from '@pure/types'
import type { QueryFileListParams } from '@pure/types'

import { getServerDB } from '../core/db-adaptor'
import { documents, files, globalFiles, knowledgeBaseFiles } from '../schemas/file'
import type { NewFile, FileItem } from '../schemas/file'
import { users } from '../schemas/user'
import type { ChatDatabase, Transaction } from '../type'

export class FileStorageQuotaExceededError extends Error {
  readonly code = 'FILE_STORAGE_QUOTA_EXCEEDED' as const

  constructor(
    readonly usedBytes: number,
    readonly limitBytes: number,
    readonly requestedBytes: number
  ) {
    super('File storage quota exceeded')
    this.name = 'FileStorageQuotaExceededError'
  }
}

export class FileModel {
  private readonly db: ChatDatabase
  private readonly userId: string

  constructor(userId: string, db: ChatDatabase = getServerDB()) {
    this.userId = userId
    this.db = db
  }

  private ownership = () => eq(files.userId, this.userId)

  private createInTransaction = async (
    tx: Transaction,
    params: Omit<NewFile, 'id' | 'userId'> & {
      id?: string
      knowledgeBaseId?: string
    },
    insertToGlobalFiles: boolean
  ): Promise<{ id: string }> => {
    if (insertToGlobalFiles && params.fileHash) {
      await tx
        .insert(globalFiles)
        .values({
          creator: this.userId,
          fileType: params.fileType,
          hashId: params.fileHash,
          metadata: params.metadata,
          size: params.size,
          url: params.url,
        })
        .onConflictDoNothing()
    }

    const [item] = await tx
      .insert(files)
      .values({ ...params, userId: this.userId })
      .returning()

    if (params.knowledgeBaseId) {
      await tx.insert(knowledgeBaseFiles).values({
        fileId: item!.id,
        knowledgeBaseId: params.knowledgeBaseId,
        userId: this.userId,
      })
    }

    return { id: item!.id }
  }

  create = async (
    params: Omit<NewFile, 'id' | 'userId'> & {
      id?: string
      knowledgeBaseId?: string
    },
    insertToGlobalFiles = false
  ): Promise<{ id: string }> => {
    return this.db.transaction((tx) => this.createInTransaction(tx, params, insertToGlobalFiles))
  }

  getStorageUsage = async (): Promise<number> => {
    const [result] = await this.db
      .select({ usedBytes: sum(files.size) })
      .from(files)
      .where(this.ownership())
    return Number(result?.usedBytes ?? 0)
  }

  createWithinStorageLimit = async (
    params: Omit<NewFile, 'id' | 'userId'> & {
      id?: string
      knowledgeBaseId?: string
    },
    limitBytes: number,
    insertToGlobalFiles = false
  ): Promise<{ id: string }> => {
    return this.db.transaction(async (tx) => {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, this.userId)).for('update')

      const [result] = await tx
        .select({ usedBytes: sum(files.size) })
        .from(files)
        .where(this.ownership())
      const usedBytes = Number(result?.usedBytes ?? 0)

      if (usedBytes + params.size > limitBytes) {
        throw new FileStorageQuotaExceededError(usedBytes, limitBytes, params.size)
      }

      return this.createInTransaction(tx, params, insertToGlobalFiles)
    })
  }

  findById = async (id: string) => {
    return this.db.query.files.findFirst({
      where: and(eq(files.id, id), this.ownership()),
    })
  }

  hasUrlReference = async (url: string) => {
    const [item] = await this.db.select({ id: files.id }).from(files).where(eq(files.url, url)).limit(1)
    return Boolean(item)
  }

  update = async (id: string, data: Partial<Pick<FileItem, 'name' | 'parentId' | 'metadata'>>) => {
    const [item] = await this.db
      .update(files)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(files.id, id), this.ownership()))
      .returning()
    return item
  }

  delete = async (id: string) => {
    return this.db.transaction(async (tx) => {
      const file = await tx.query.files.findFirst({
        where: and(eq(files.id, id), this.ownership()),
      })
      if (!file) return null

      await tx.delete(knowledgeBaseFiles).where(eq(knowledgeBaseFiles.fileId, id))
      await tx.delete(documents).where(and(eq(documents.fileId, id), eq(documents.userId, this.userId)))
      await tx.delete(files).where(and(eq(files.id, id), this.ownership()))

      if (file.fileHash) {
        const remaining = await tx.select({ count: count() }).from(files).where(eq(files.fileHash, file.fileHash))
        if ((remaining[0]?.count ?? 0) === 0) {
          await tx.delete(globalFiles).where(eq(globalFiles.hashId, file.fileHash))
        }
      }

      return file
    })
  }

  deleteMany = async (ids: string[]) => {
    const results = []
    for (const id of ids) {
      const deleted = await this.delete(id)
      if (deleted) results.push(deleted)
    }
    return results
  }

  query = async (params: QueryFileListParams = {}) => {
    const {
      category,
      q,
      sortType,
      sorter,
      knowledgeBaseId,
      showFilesInKnowledgeBase,
      parentId,
      limit = 50,
      offset = 0,
    } = params

    let whereClause = and(q ? ilike(files.name, `%${q}%`) : undefined, this.ownership())

    if (category && category !== FilesTabs.All && category !== FilesTabs.Home) {
      const prefix = this.getFileTypePrefix(category as FilesTabs)
      if (Array.isArray(prefix)) {
        whereClause = and(whereClause, or(...prefix.map((p) => ilike(files.fileType, `${p}%`))))
      } else {
        whereClause = and(whereClause, ilike(files.fileType, `${prefix}%`))
      }
    }

    if (parentId === null || parentId === undefined) {
      whereClause = and(whereClause, isNull(files.parentId))
    } else if (parentId) {
      whereClause = and(whereClause, eq(files.parentId, parentId))
    }

    if (knowledgeBaseId) {
      const kbFileIds = await this.db
        .select({ fileId: knowledgeBaseFiles.fileId })
        .from(knowledgeBaseFiles)
        .where(and(eq(knowledgeBaseFiles.knowledgeBaseId, knowledgeBaseId), eq(knowledgeBaseFiles.userId, this.userId)))
      const ids = kbFileIds.map((r) => r.fileId)
      if (ids.length === 0 && !showFilesInKnowledgeBase) {
        return []
      }
      whereClause = and(whereClause, ids.length > 0 ? inArray(files.id, ids) : eq(files.id, ''))
    }

    const sortableFields = {
      createdAt: files.createdAt,
      name: files.name,
      size: files.size,
      updatedAt: files.updatedAt,
    } as const

    let orderByClause = desc(files.createdAt)
    if (sorter && sortType && sorter in sortableFields) {
      const sortFn = sortType.toLowerCase() === SortType.Asc ? asc : desc
      orderByClause = sortFn(sortableFields[sorter as keyof typeof sortableFields])
    }

    return this.db.select().from(files).where(whereClause).orderBy(orderByClause).limit(limit).offset(offset)
  }

  private getFileTypePrefix = (category: FilesTabs) => {
    switch (category) {
      case FilesTabs.Images:
        return 'image'
      case FilesTabs.Videos:
        return 'video'
      case FilesTabs.Audios:
        return 'audio'
      case FilesTabs.Documents:
        return ['application', 'custom', 'text']
      default:
        return ''
    }
  }
}
