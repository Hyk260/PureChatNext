// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  desktopArtifacts,
  desktopReleaseNotes,
  remoteTagCommit,
  validateDesktopDraft,
  verifyDesktopArtifacts,
  writeDesktopDraft,
} from './github-desktop-release.mjs'

const version = '0.3.0'
const repository = 'Hyk260/PureChatNext'
const sha = 'a'.repeat(40)
const otherSha = 'b'.repeat(40)
const notes = '# 桌面端更新\n\n- 支持聊天。\n'
const draft = { tag_name: 'v0.3.0', draft: true, target_commitish: sha }
let directory: string

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'purechat-desktop-release-test-'))
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

function createArtifacts() {
  for (const filename of desktopArtifacts(version)) writeFileSync(path.join(directory, filename), 'artifact')
}

function fakeCommands(releases: object[] = [], tagRefs = '') {
  return vi.fn((command: string, args: string[]) => {
    if (command === 'git') return tagRefs
    if (args[0] === 'api') return JSON.stringify([[], releases])
    return ''
  })
}

describe('desktop distribution artifacts', () => {
  it('maps stable versions to exactly the four configured files', () => {
    expect(desktopArtifacts(version)).toEqual([
      'PureChat-0.3.0-setup.exe',
      'PureChat-0.3.0-portable.exe',
      'PureChat-0.3.0-arm64.dmg',
      'PureChat-0.3.0-arm64.zip',
    ])
    expect(desktopArtifacts(version, 'windows')).toEqual(desktopArtifacts(version).slice(0, 2))
    expect(desktopArtifacts(version, 'mac')).toEqual(desktopArtifacts(version).slice(2))
  })

  it.each(['v0.3.0', '0.3', '00.3.0', '0.3.0-beta.1', '../0.3.0', '0.3.0\n'])('rejects version %j', (value) => {
    expect(() => desktopArtifacts(value)).toThrow('X.Y.Z')
  })

  it('rejects unsupported platforms', () => {
    expect(() => desktopArtifacts(version, 'linux')).toThrow('未知桌面平台')
  })

  it('selects only the exact platform files, ignoring old files and builder metadata', () => {
    for (const filename of desktopArtifacts(version, 'mac')) writeFileSync(path.join(directory, filename), 'mac')
    writeFileSync(path.join(directory, 'PureChat-0.2.8-arm64.zip'), 'old')
    writeFileSync(path.join(directory, 'builder-debug.yml'), 'debug')
    expect(verifyDesktopArtifacts(directory, version, 'mac')).toEqual(
      desktopArtifacts(version, 'mac').map((filename) => path.join(directory, filename))
    )
    expect(() => verifyDesktopArtifacts(directory, version)).toThrow('缺少桌面产物: PureChat-0.3.0-setup.exe')
  })

  it('rejects missing, empty, directory and symlink artifacts', () => {
    createArtifacts()
    const file = path.join(directory, desktopArtifacts(version)[0])
    rmSync(file)
    expect(() => verifyDesktopArtifacts(directory, version)).toThrow('缺少桌面产物')
    writeFileSync(file, '')
    expect(() => verifyDesktopArtifacts(directory, version)).toThrow('非空普通文件')
    rmSync(file)
    mkdirSync(file)
    expect(() => verifyDesktopArtifacts(directory, version)).toThrow('非空普通文件')
    rmSync(file, { recursive: true })
    symlinkSync(path.join(directory, desktopArtifacts(version)[1]), file)
    expect(() => verifyDesktopArtifacts(directory, version)).toThrow('非空普通文件')
  })
})

describe('desktop release notes', () => {
  it('generates matching download links and preserves the desktop Markdown notes', () => {
    const body = desktopReleaseNotes({ version, repository, notes })
    for (const file of desktopArtifacts(version)) {
      expect(body).toContain(`https://github.com/${repository}/releases/download/v${version}/${file}`)
    }
    expect(body).toContain('| Windows | x64 | [Installer](')
    expect(body).toContain('| macOS | Apple silicon (arm64) | [DMG](')
    expect(body).toContain('未接入正式代码签名')
    expect(body).toContain(notes.trim())
    expect(body).not.toContain('| Linux |')
  })

  it('rejects missing notes and invalid repository names', () => {
    expect(() => desktopReleaseNotes({ version, repository, notes: ' \n' })).toThrow('不能为空')
    expect(() => desktopReleaseNotes({ version, repository: '', notes })).toThrow('仓库名')
  })
})

describe('desktop draft binding', () => {
  it('allows new drafts and same-commit retries', () => {
    expect(() => validateDesktopDraft({ release: undefined, tagCommit: null, sha })).not.toThrow()
    expect(() => validateDesktopDraft({ release: draft, tagCommit: sha, sha })).not.toThrow()
  })

  it('rejects published versions, different sources, conflicting tags and incomplete SHAs', () => {
    expect(() => validateDesktopDraft({ release: { ...draft, draft: false }, tagCommit: sha, sha })).toThrow(
      '已公开发布'
    )
    expect(() =>
      validateDesktopDraft({ release: { ...draft, target_commitish: otherSha }, tagCommit: null, sha })
    ).toThrow('草稿来源')
    expect(() => validateDesktopDraft({ release: undefined, tagCommit: otherSha, sha })).toThrow('tag 指向不同 commit')
    expect(() => validateDesktopDraft({ release: undefined, tagCommit: null, sha: 'main' })).toThrow('完整 commit SHA')
  })

  it('compares the peeled commit of annotated tags and handles absent tags', () => {
    expect(remoteTagCommit(`${otherSha}\trefs/tags/v0.3.0\n${sha}\trefs/tags/v0.3.0^{}\n`, 'v0.3.0')).toBe(sha)
    expect(remoteTagCommit(`${sha}\trefs/tags/v0.3.0\n`, 'v0.3.0')).toBe(sha)
    expect(remoteTagCommit('', 'v0.3.0')).toBeNull()
  })
})

describe('desktop draft upload', () => {
  it('creates an unpublished draft for the exact SHA and uploads only four files', () => {
    createArtifacts()
    writeFileSync(path.join(directory, 'builder-debug.yml'), 'debug')
    const run = fakeCommands()
    const bodyFiles: string[] = []
    run.mockImplementation((command, args) => {
      if (command === 'git') return ''
      if (args[0] === 'api') return '[[]]'
      if (args[1] === 'create') {
        const notesFile = args[args.indexOf('--notes-file') + 1]
        bodyFiles.push(notesFile)
        expect(readFileSync(notesFile, 'utf8')).toContain(notes.trim())
      }
      return ''
    })
    expect(writeDesktopDraft({ directory, version, repository, sha, notes }, run)).toBe('v0.3.0')
    expect(run).toHaveBeenCalledWith('gh', expect.arrayContaining(['--target', sha, '--draft', '--title', 'v0.3.0']))
    expect(run).toHaveBeenLastCalledWith('gh', [
      'release',
      'upload',
      'v0.3.0',
      ...desktopArtifacts(version).map((file) => path.join(directory, file)),
      '--repo',
      repository,
      '--clobber',
    ])
    expect(bodyFiles).toHaveLength(1)
    expect(existsSync(bodyFiles[0])).toBe(false)
  })

  it('updates a same-commit draft without publishing or creating another Release', () => {
    createArtifacts()
    const run = fakeCommands([draft])
    writeDesktopDraft({ directory, version, repository, sha, notes }, run)
    expect(run).toHaveBeenCalledWith('gh', expect.arrayContaining(['release', 'edit', 'v0.3.0']))
    expect(run.mock.calls.some(([, args]) => args.includes('create') || args.includes('--draft'))).toBe(false)
  })

  it.each([
    { releases: [{ ...draft, draft: false }], tagRefs: '', message: '已公开发布' },
    { releases: [{ ...draft, target_commitish: otherSha }], tagRefs: '', message: '草稿来源' },
    { releases: [], tagRefs: `${otherSha}\trefs/tags/v0.3.0`, message: 'tag 指向不同 commit' },
    { releases: [draft, draft], tagRefs: '', message: '多个 Release' },
  ])('rejects unsafe release state before any writes ($message)', ({ releases, tagRefs, message }) => {
    createArtifacts()
    const run = fakeCommands(releases, tagRefs)
    expect(() => writeDesktopDraft({ directory, version, repository, sha, notes }, run)).toThrow(message)
    expect(run.mock.calls.some(([, args]) => args[0] === 'release')).toBe(false)
  })

  it('does not contact GitHub when an artifact is missing', () => {
    const run = fakeCommands()
    expect(() => writeDesktopDraft({ directory, version, repository, sha, notes }, run)).toThrow('缺少桌面产物')
    expect(run).not.toHaveBeenCalled()
  })

  it('propagates API failures instead of treating them as a missing Release', () => {
    createArtifacts()
    const run = fakeCommands()
    run.mockImplementation(() => {
      throw new Error('GitHub API unavailable')
    })
    expect(() => writeDesktopDraft({ directory, version, repository, sha, notes }, run)).toThrow('API unavailable')
    expect(run).toHaveBeenCalledTimes(1)
  })
})
