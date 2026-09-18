import { and, desc, eq } from 'drizzle-orm'

import { getServerDB } from '../core/db-adaptor'
import { userSkillFiles, userSkills } from '../schemas/userSkill'
import type { UserSkillFileItem, UserSkillItem } from '../schemas/userSkill'
import type { ChatDatabase } from '../type'

export class UserSkillAlreadyInstalledError extends Error {
  constructor(public readonly identifier: string) {
    super(`Skill already installed: ${identifier}`)
    this.name = 'UserSkillAlreadyInstalledError'
  }
}

export type UserSkillFileInput = {
  fileType: string
  path: string
  s3Key: string
  sha256: string
  size: number
}

export type UserSkillCreateInput = {
  description?: string | null
  files: UserSkillFileInput[]
  githubBranch: string
  githubOwner: string
  githubPath?: string | null
  githubRepo: string
  homepage?: string | null
  icon?: string | null
  id: string
  identifier: string
  name: string
  version?: string | null
}

const isUniqueViolation = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { cause?: { code?: string }; code?: string }
  return candidate.code === '23505' || candidate.cause?.code === '23505'
}

export class UserSkillModel {
  private readonly db: ChatDatabase
  private readonly userId: string

  constructor(userId: string, db: ChatDatabase = getServerDB()) {
    this.userId = userId
    this.db = db
  }

  private ownedSkill = (skillId: string) => and(eq(userSkills.id, skillId), eq(userSkills.userId, this.userId))

  list = async (): Promise<UserSkillItem[]> => {
    return this.db.query.userSkills.findMany({
      where: eq(userSkills.userId, this.userId),
      orderBy: [desc(userSkills.createdAt)],
    })
  }

  findById = async (id: string): Promise<UserSkillItem | undefined> => {
    return this.db.query.userSkills.findFirst({
      where: this.ownedSkill(id),
    })
  }

  findByIdentifier = async (identifier: string): Promise<UserSkillItem | undefined> => {
    return this.db.query.userSkills.findFirst({
      where: and(eq(userSkills.userId, this.userId), eq(userSkills.identifier, identifier)),
    })
  }

  listFiles = async (skillId: string): Promise<UserSkillFileItem[]> => {
    const skill = await this.findById(skillId)
    if (!skill) return []

    return this.db.query.userSkillFiles.findMany({
      where: eq(userSkillFiles.skillId, skillId),
    })
  }

  findFile = async (skillId: string, path: string): Promise<UserSkillFileItem | undefined> => {
    const skill = await this.findById(skillId)
    if (!skill) return undefined

    return this.db.query.userSkillFiles.findFirst({
      where: and(eq(userSkillFiles.skillId, skillId), eq(userSkillFiles.path, path)),
    })
  }

  create = async (input: UserSkillCreateInput): Promise<UserSkillItem> => {
    const fileCount = input.files.length
    const totalSize = input.files.reduce((sum, file) => sum + file.size, 0)

    try {
      return await this.db.transaction(async (tx) => {
        const [skill] = await tx
          .insert(userSkills)
          .values({
            description: input.description,
            fileCount,
            githubBranch: input.githubBranch,
            githubOwner: input.githubOwner,
            githubPath: input.githubPath,
            githubRepo: input.githubRepo,
            homepage: input.homepage,
            icon: input.icon,
            id: input.id,
            identifier: input.identifier,
            name: input.name,
            totalSize,
            userId: this.userId,
            version: input.version,
          })
          .returning()

        if (input.files.length > 0) {
          await tx.insert(userSkillFiles).values(
            input.files.map((file) => ({
              fileType: file.fileType,
              path: file.path,
              s3Key: file.s3Key,
              sha256: file.sha256,
              size: file.size,
              skillId: input.id,
            }))
          )
        }

        return skill!
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new UserSkillAlreadyInstalledError(input.identifier)
      }
      throw error
    }
  }

  delete = async (id: string): Promise<UserSkillItem | undefined> => {
    const [deleted] = await this.db.delete(userSkills).where(this.ownedSkill(id)).returning()
    return deleted
  }
}
