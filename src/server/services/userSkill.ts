import { createHash } from 'node:crypto'

import debug from 'debug'
import mime from 'mime'

import { UserSkillAlreadyInstalledError, UserSkillModel } from '@pure/database/models/userSkill'
import type { UserSkillFileItem, UserSkillItem } from '@pure/database/schemas/userSkill'
import { idGenerator } from '@pure/database/utils/idGenerator'
import { findCommunitySkill, getCommunitySkillSourceUrl } from '@/const/community/skills'
import { getCommunitySkillReadmeSnapshot } from '@/const/community/skills.readme'
import {
  GitHubDownloadError,
  GitHubNotFoundError,
  GitHubParseError,
  GitHubRateLimitError,
  github,
} from '@/server/modules/GitHub'
import {
  SkillPackageError,
  buildSkillObjectKey,
  collectSkillFiles,
  skillReadmeRepoPath,
  skillRootPrefix,
} from '@/server/modules/GitHub/skillFiles'
import { FileS3 } from '@/server/modules/S3'
import { isS3Configured } from '@/server/modules/S3/config'

const log = debug('skill:install')
const githubLog = debug('skill:github')

export class SkillCatalogNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Skill not found in catalog: ${identifier}`)
    this.name = 'SkillCatalogNotFoundError'
  }
}

export class SkillSourceUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillSourceUnavailableError'
  }
}

export class SkillS3NotConfiguredError extends Error {
  constructor() {
    super('S3 is not configured')
    this.name = 'SkillS3NotConfiguredError'
  }
}

const isGitHubSourceError = (error: unknown) =>
  error instanceof GitHubNotFoundError ||
  error instanceof GitHubDownloadError ||
  error instanceof GitHubRateLimitError ||
  error instanceof GitHubParseError

const wrapGitHubError = (error: unknown): never => {
  if (error instanceof GitHubRateLimitError) {
    throw new SkillSourceUnavailableError('GitHub 请求过于频繁，请稍后重试')
  }
  if (isGitHubSourceError(error)) {
    throw new SkillSourceUnavailableError(error.message)
  }
  throw error
}

const resolveCatalogSource = (identifier: string) => {
  const skill = findCommunitySkill(identifier)
  if (!skill) throw new SkillCatalogNotFoundError(identifier)

  const sourceUrl = getCommunitySkillSourceUrl(skill)
  if (!sourceUrl) throw new SkillCatalogNotFoundError(identifier)

  try {
    return { repo: github.parseRepoUrl(sourceUrl), skill }
  } catch (error) {
    return wrapGitHubError(error)
  }
}

export const getCommunitySkillReadme = async (identifier: string) => {
  if (!findCommunitySkill(identifier)) throw new SkillCatalogNotFoundError(identifier)

  const snapshot = getCommunitySkillReadmeSnapshot(identifier)
  if (snapshot) return snapshot

  const { repo } = resolveCatalogSource(identifier)
  const filePath = skillReadmeRepoPath(repo)
  githubLog('readme identifier=%s filePath=%s', identifier, filePath)

  try {
    return await github.downloadRawFile({ ...repo, filePath })
  } catch (error) {
    if (error instanceof GitHubNotFoundError) {
      throw new SkillCatalogNotFoundError(identifier)
    }
    return wrapGitHubError(error)
  }
}

const mimeForPath = (relativePath: string) => mime.getType(relativePath) || 'application/octet-stream'

const cleanupUploadedKeys = async (s3: FileS3, keys: string[], prefix: string) => {
  const toDelete = new Set(keys)
  try {
    const listed = await s3.listFiles(prefix)
    for (const object of listed) {
      if (object.Key) toDelete.add(object.Key)
    }
  } catch (error) {
    log('listFiles cleanup failed for %s: %O', prefix, error)
  }

  const uniqueKeys = [...toDelete].filter(Boolean)
  if (uniqueKeys.length === 0) return
  await s3.deleteFiles(uniqueKeys)
}

export const installCommunitySkill = async (userId: string, identifier: string) => {
  if (!isS3Configured()) throw new SkillS3NotConfiguredError()

  const model = new UserSkillModel(userId)
  const existing = await model.findByIdentifier(identifier)
  if (existing) throw new UserSkillAlreadyInstalledError(identifier)

  const { repo, skill } = resolveCatalogSource(identifier)
  githubLog('install identifier=%s repo=%s/%s path=%s', identifier, repo.owner, repo.repo, repo.path ?? '')

  let listed
  try {
    listed = await collectSkillFiles(repo, (dirPath) => github.listDirectoryContents(repo, dirPath))
  } catch (error) {
    if (error instanceof SkillPackageError) throw error
    return wrapGitHubError(error)
  }

  const skillId = idGenerator('userSkills')
  const prefix = skillRootPrefix(userId, skillId)
  const s3 = new FileS3()
  const uploadedKeys: string[] = []

  try {
    const files = []
    for (const item of listed) {
      let buffer: Buffer
      try {
        buffer = await github.downloadRawFileBuffer({ ...repo, filePath: item.repoPath })
      } catch (error) {
        return wrapGitHubError(error)
      }

      const fileType = mimeForPath(item.relativePath)
      const s3Key = buildSkillObjectKey(userId, skillId, item.relativePath)
      await s3.uploadBuffer(s3Key, buffer, fileType)
      uploadedKeys.push(s3Key)
      files.push({
        fileType,
        path: item.relativePath,
        s3Key,
        sha256: createHash('sha256').update(buffer).digest('hex'),
        size: buffer.byteLength,
      })
    }

    const created = await model.create({
      description: skill.description,
      files,
      githubBranch: repo.branch,
      githubOwner: repo.owner,
      githubPath: repo.path ?? null,
      githubRepo: repo.repo,
      homepage: skill.homepage ?? null,
      icon: skill.icon ?? null,
      id: skillId,
      identifier: skill.identifier,
      name: skill.name,
      version: skill.version ?? null,
    })

    return created
  } catch (error) {
    try {
      await cleanupUploadedKeys(s3, uploadedKeys, prefix)
    } catch (cleanupError) {
      log('orphan cleanup failed for %s: %O', prefix, cleanupError)
    }
    throw error
  }
}

export const uninstallCommunitySkill = async (userId: string, skillId: string): Promise<UserSkillItem | undefined> => {
  const model = new UserSkillModel(userId)
  const skill = await model.findById(skillId)
  if (!skill) return undefined

  const files = await model.listFiles(skillId)
  if (isS3Configured()) {
    const s3 = new FileS3()
    await cleanupUploadedKeys(
      s3,
      files.map((file) => file.s3Key),
      skillRootPrefix(userId, skillId)
    )
  }

  return model.delete(skillId)
}

export const getUserSkillFile = async (
  userId: string,
  skillId: string,
  path: string
): Promise<UserSkillFileItem | undefined> => {
  return new UserSkillModel(userId).findFile(skillId, path)
}
