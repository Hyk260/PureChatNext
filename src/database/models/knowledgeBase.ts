import { and, desc, eq, inArray } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import { type KnowledgeBaseItem, type NewKnowledgeBase, documents, files, knowledgeBaseFiles, knowledgeBases } from '../schemas/file'
import { type ChatDatabase } from '../type'

export class KnowledgeBaseModel {
  private readonly db: ChatDatabase
  private readonly userId: string

  constructor(userId: string, db: ChatDatabase = getServerDB()) {
    this.userId = userId
    this.db = db
  }

  private ownership = () => eq(knowledgeBases.userId, this.userId)

  create = async (params: Omit<NewKnowledgeBase, 'userId'>) => {
    const [item] = await this.db
      .insert(knowledgeBases)
      .values({ ...params, userId: this.userId })
      .returning()
    return item!
  }

  findById = async (id: string) => {
    return this.db.query.knowledgeBases.findFirst({
      where: and(eq(knowledgeBases.id, id), this.ownership()),
    })
  }

  list = async () => {
    return this.db.query.knowledgeBases.findMany({
      where: this.ownership(),
      orderBy: [desc(knowledgeBases.updatedAt)],
    })
  }

  update = async (id: string, data: Partial<Pick<KnowledgeBaseItem, 'name' | 'description' | 'avatar'>>) => {
    const [item] = await this.db
      .update(knowledgeBases)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(knowledgeBases.id, id), this.ownership()))
      .returning()
    return item
  }

  delete = async (id: string) => {
    return this.db.delete(knowledgeBases).where(and(eq(knowledgeBases.id, id), this.ownership()))
  }

  addFiles = async (knowledgeBaseId: string, fileIds: string[]) => {
    if (fileIds.length === 0) return []

    const documentIds = fileIds.filter((id) => id.startsWith('docs_'))
    const directFileIds = fileIds.filter((id) => !id.startsWith('docs_'))

    const resolvedFileIds = [...directFileIds]

    if (documentIds.length > 0) {
      const docsWithFiles = await this.db
        .select({ fileId: documents.fileId, id: documents.id })
        .from(documents)
        .where(and(inArray(documents.id, documentIds), eq(documents.userId, this.userId)))

      resolvedFileIds.push(
        ...docsWithFiles.map((d) => d.fileId).filter((id): id is string => Boolean(id)),
      )

      await this.db
        .update(documents)
        .set({ knowledgeBaseId })
        .where(and(inArray(documents.id, documentIds), eq(documents.userId, this.userId)))
    }

    if (resolvedFileIds.length === 0) return []

    return this.db
      .insert(knowledgeBaseFiles)
      .values(
        resolvedFileIds.map((fileId) => ({
          fileId,
          knowledgeBaseId,
          userId: this.userId,
        })),
      )
      .onConflictDoNothing()
      .returning()
  }

  removeFiles = async (knowledgeBaseId: string, ids: string[]) => {
    const documentIds = ids.filter((id) => id.startsWith('docs_'))
    const directFileIds = ids.filter((id) => !id.startsWith('docs_'))

    const resolvedFileIds = [...directFileIds]

    if (documentIds.length > 0) {
      const docsWithFiles = await this.db
        .select({ fileId: documents.fileId })
        .from(documents)
        .where(and(inArray(documents.id, documentIds), eq(documents.userId, this.userId)))

      resolvedFileIds.push(
        ...docsWithFiles.map((d) => d.fileId).filter((id): id is string => Boolean(id)),
      )

      await this.db
        .update(documents)
        .set({ knowledgeBaseId: null })
        .where(
          and(
            inArray(documents.id, documentIds),
            eq(documents.userId, this.userId),
            eq(documents.knowledgeBaseId, knowledgeBaseId),
          ),
        )
    }

    if (resolvedFileIds.length === 0) return

    await this.db
      .delete(knowledgeBaseFiles)
      .where(
        and(
          eq(knowledgeBaseFiles.knowledgeBaseId, knowledgeBaseId),
          inArray(knowledgeBaseFiles.fileId, resolvedFileIds),
        ),
      )
  }
}
