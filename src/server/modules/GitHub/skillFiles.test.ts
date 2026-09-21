import { describe, expect, it } from 'vitest'

import type { GitHubContentItem } from './index'
import {
  SKILL_MAX_DEPTH,
  SKILL_MAX_FILE_BYTES,
  SKILL_MAX_FILES,
  SkillPackageError,
  buildSkillObjectKey,
  collectSkillFiles,
  sanitizeSkillRelativePath,
  skillReadmeRepoPath,
  skillRootPrefix,
  toSkillRelativePath,
  userSkillsPrefix,
} from './skillFiles'

const file = (path: string, size = 12): GitHubContentItem => {
  const name = path.slice(path.lastIndexOf('/') + 1)
  return { name, path, sha: name, size, type: 'file' }
}

const dir = (path: string): GitHubContentItem => {
  const name = path.slice(path.lastIndexOf('/') + 1)
  return { name, path, sha: name, size: 0, type: 'dir' }
}

describe('sanitizeSkillRelativePath', () => {
  it('accepts posix relative paths', () => {
    expect(sanitizeSkillRelativePath('SKILL.md')).toBe('SKILL.md')
    expect(sanitizeSkillRelativePath('scripts/run.sh')).toBe('scripts/run.sh')
  })

  it('rejects traversal and absolute paths', () => {
    expect(() => sanitizeSkillRelativePath('../SKILL.md')).toThrow(SkillPackageError)
    expect(() => sanitizeSkillRelativePath('/SKILL.md')).toThrow(SkillPackageError)
    expect(() => sanitizeSkillRelativePath('scripts\\run.sh')).toThrow(SkillPackageError)
    expect(() => sanitizeSkillRelativePath('scripts//run.sh')).toThrow(SkillPackageError)
    expect(() => sanitizeSkillRelativePath('scripts/./run.sh')).toThrow(SkillPackageError)
  })

  it('rejects paths deeper than the limit', () => {
    const deep = Array.from({ length: SKILL_MAX_DEPTH + 2 }, (_, index) => `d${index}`).join('/')
    expect(() => sanitizeSkillRelativePath(`${deep}/file.txt`)).toThrowError(/TOO_DEEP|max depth/)
  })
})

describe('skill object keys', () => {
  it('prefixes user and skill ids', () => {
    expect(userSkillsPrefix('user_1')).toBe('skills/user_1/')
    expect(buildSkillObjectKey('user_1', 'usk_1', 'scripts/run.sh')).toBe('skills/user_1/usk_1/scripts/run.sh')
    expect(skillRootPrefix('user_1', 'usk_1')).toBe('skills/user_1/usk_1/')
  })
})

describe('toSkillRelativePath', () => {
  it('strips the skill directory prefix', () => {
    expect(toSkillRelativePath('skills/demo/SKILL.md', 'skills/demo')).toBe('SKILL.md')
    expect(toSkillRelativePath('SKILL.md')).toBe('SKILL.md')
  })
})

describe('skillReadmeRepoPath', () => {
  it('joins SKILL.md onto the parsed directory', () => {
    expect(skillReadmeRepoPath({ branch: 'main', owner: 'o', repo: 'r', path: 'skills/demo' })).toBe(
      'skills/demo/SKILL.md'
    )
    expect(skillReadmeRepoPath({ branch: 'main', owner: 'o', repo: 'r' })).toBe('SKILL.md')
  })
})

describe('collectSkillFiles', () => {
  it('walks only the skill directory and skips junk', async () => {
    const listing: Record<string, GitHubContentItem[]> = {
      'skills/demo': [
        file('skills/demo/SKILL.md', 20),
        file('skills/demo/LICENSE', 12),
        dir('skills/demo/scripts'),
        dir('skills/demo/node_modules'),
      ],
      'skills/demo/scripts': [file('skills/demo/scripts/run.sh', 8), file('skills/demo/scripts/.DS_Store', 4)],
      'skills/demo/node_modules': [file('skills/demo/node_modules/left-pad/index.js', 4)],
    }

    const files = await collectSkillFiles({ branch: 'main', owner: 'o', path: 'skills/demo', repo: 'r' }, (dirPath) =>
      Promise.resolve(listing[dirPath] ?? [])
    )

    expect(files).toEqual([
      { relativePath: 'SKILL.md', repoPath: 'skills/demo/SKILL.md', size: 20 },
      { relativePath: 'scripts/run.sh', repoPath: 'skills/demo/scripts/run.sh', size: 8 },
    ])
  })

  it('requires SKILL.md at the skill root', async () => {
    await expect(
      collectSkillFiles({ branch: 'main', owner: 'o', repo: 'r' }, async () => [file('README.md')])
    ).rejects.toMatchObject({ code: 'MISSING_SKILL_MD' })
  })

  it('rejects packages over the file count', async () => {
    const items = [file('SKILL.md'), ...Array.from({ length: SKILL_MAX_FILES }, (_, index) => file(`f${index}.txt`))]

    await expect(
      collectSkillFiles({ branch: 'main', owner: 'o', repo: 'r' }, async () => items)
    ).rejects.toMatchObject({ code: 'TOO_MANY_FILES' })
  })

  it('rejects an oversized file', async () => {
    await expect(
      collectSkillFiles({ branch: 'main', owner: 'o', repo: 'r' }, async () => [
        file('SKILL.md', 10),
        file('big.bin', SKILL_MAX_FILE_BYTES + 1),
      ])
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' })
  })
})
