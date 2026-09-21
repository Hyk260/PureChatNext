import type { GitHubContentItem, GitHubRepoInfo } from './index'

export const SKILL_README_NAME = 'SKILL.md'
export const SKILL_MAX_FILES = 80
export const SKILL_MAX_TOTAL_BYTES = 8 * 1024 * 1024
export const SKILL_MAX_FILE_BYTES = 1024 * 1024
export const SKILL_MAX_DEPTH = 6
export const SKILL_PATH_MAX_LENGTH = 240

const SKIPPED_FILE_NAMES = new Set(['.ds_store', 'copying', 'licence', 'license', 'license.md', 'license.txt'])
const SKIPPED_DIR_NAMES = new Set(['node_modules'])

export type SkillPackageErrorCode =
  | 'FILE_TOO_LARGE'
  | 'INVALID_PATH'
  | 'MISSING_SKILL_MD'
  | 'PACKAGE_TOO_LARGE'
  | 'TOO_DEEP'
  | 'TOO_MANY_FILES'

export class SkillPackageError extends Error {
  constructor(
    public readonly code: SkillPackageErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'SkillPackageError'
  }
}

export type SkillListedFile = {
  relativePath: string
  repoPath: string
  size: number
}

export type ListDirectoryFn = (dirPath: string) => Promise<GitHubContentItem[]>

const isSkippedDirectory = (name: string) => name.startsWith('.') || SKIPPED_DIR_NAMES.has(name)

const isSkippedFile = (name: string) => SKIPPED_FILE_NAMES.has(name.toLowerCase())

export const skillReadmeRepoPath = (info: GitHubRepoInfo) =>
  [info.path, SKILL_README_NAME].filter(Boolean).join('/')

export const buildSkillObjectKey = (userId: string, skillId: string, relativePath: string) =>
  `skills/${userId}/${skillId}/${sanitizeSkillRelativePath(relativePath)}`

export const userSkillsPrefix = (userId: string) => `skills/${userId}/`

export const skillRootPrefix = (userId: string, skillId: string) => `${userSkillsPrefix(userId)}${skillId}/`

export const toSkillRelativePath = (repoPath: string, skillRoot?: string) => {
  if (!skillRoot) return repoPath
  if (repoPath === skillRoot) {
    throw new SkillPackageError('INVALID_PATH', `Path is the skill root: ${repoPath}`)
  }
  const prefix = skillRoot.endsWith('/') ? skillRoot : `${skillRoot}/`
  if (!repoPath.startsWith(prefix)) {
    throw new SkillPackageError('INVALID_PATH', `Path is outside the skill directory: ${repoPath}`)
  }
  return repoPath.slice(prefix.length)
}

export const pathDepth = (relativePath: string) => relativePath.split('/').length - 1

export const sanitizeSkillRelativePath = (relativePath: string) => {
  if (!relativePath || relativePath.includes('\0') || relativePath.includes('\\') || relativePath.startsWith('/')) {
    throw new SkillPackageError('INVALID_PATH', `Invalid skill file path: ${relativePath}`)
  }

  const segments = relativePath.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new SkillPackageError('INVALID_PATH', `Invalid skill file path: ${relativePath}`)
  }
  if (segments.some((segment) => segment.length > SKILL_PATH_MAX_LENGTH)) {
    throw new SkillPackageError('INVALID_PATH', `Skill path segment too long: ${relativePath}`)
  }
  if (relativePath.length > SKILL_PATH_MAX_LENGTH) {
    throw new SkillPackageError('INVALID_PATH', `Skill path too long: ${relativePath}`)
  }
  if (pathDepth(relativePath) > SKILL_MAX_DEPTH) {
    throw new SkillPackageError('TOO_DEEP', `Skill path exceeds max depth: ${relativePath}`)
  }

  return relativePath
}

const assertPackageLimits = (files: SkillListedFile[], nextSize: number) => {
  if (files.length >= SKILL_MAX_FILES) {
    throw new SkillPackageError('TOO_MANY_FILES', `Skill has more than ${SKILL_MAX_FILES} files`)
  }
  const total = files.reduce((sum, file) => sum + file.size, 0) + nextSize
  if (total > SKILL_MAX_TOTAL_BYTES) {
    throw new SkillPackageError('PACKAGE_TOO_LARGE', `Skill exceeds ${SKILL_MAX_TOTAL_BYTES} bytes`)
  }
}

export const collectSkillFiles = async (
  info: GitHubRepoInfo,
  listDirectory: ListDirectoryFn
): Promise<SkillListedFile[]> => {
  const files: SkillListedFile[] = []
  const skillRoot = info.path

  const walk = async (dirPath: string) => {
    const items = await listDirectory(dirPath)

    for (const item of items) {
      if (item.type === 'dir') {
        if (isSkippedDirectory(item.name)) continue
        await walk(item.path)
        continue
      }

      if (item.type !== 'file' || isSkippedFile(item.name)) continue

      if (item.size > SKILL_MAX_FILE_BYTES) {
        throw new SkillPackageError('FILE_TOO_LARGE', `File exceeds ${SKILL_MAX_FILE_BYTES} bytes: ${item.path}`)
      }

      const relativePath = sanitizeSkillRelativePath(toSkillRelativePath(item.path, skillRoot))
      assertPackageLimits(files, item.size)
      files.push({ relativePath, repoPath: item.path, size: item.size })
    }
  }

  await walk(skillRoot ?? '')

  if (!files.some((file) => file.relativePath === SKILL_README_NAME)) {
    throw new SkillPackageError('MISSING_SKILL_MD', 'Skill directory is missing SKILL.md')
  }

  return files
}
