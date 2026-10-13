// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  desktopArtifacts,
  desktopReleaseNotes,
  remoteTagCommit,
  validateDesktopBuildConfig,
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

describe('desktop build preflight', () => {
  const config = { version, repository, sha, notes, cloudUrl: 'https://next.purechat.cn' }

  it('accepts official and self-hosted HTTP(S) servers', () => {
    expect(() => validateDesktopBuildConfig(config)).not.toThrow()
    expect(() => validateDesktopBuildConfig({ ...config, cloudUrl: 'http://localhost:5174' })).not.toThrow()
  })

  it.each(['', 'next.purechat.cn', 'ftp://example.com', 'https://user:password@example.com'])(
    'rejects invalid cloud URL %j',
    (cloudUrl) => {
      expect(() => validateDesktopBuildConfig({ ...config, cloudUrl })).toThrow('PURECHAT_DESKTOP_CLOUD_URL')
    }
  )

  it('requires stable versions, repository context, a complete SHA and nonempty notes before building', () => {
    expect(() => validateDesktopBuildConfig({ ...config, version: '0.3.0-beta.1' })).toThrow('X.Y.Z')
    expect(() => validateDesktopBuildConfig({ ...config, repository: '' })).toThrow('仓库名')
    expect(() => validateDesktopBuildConfig({ ...config, sha: 'main' })).toThrow('完整 commit SHA')
    expect(() => validateDesktopBuildConfig({ ...config, notes: ' \n' })).toThrow('不能为空')
  })

  it('exposes a version-only CLI output on success and exits nonzero on invalid environment or empty notes', () => {
    const notesDir = path.join(directory, 'apps/desktop/build')
    mkdirSync(notesDir, { recursive: true })
    writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ version }))
    writeFileSync(path.join(notesDir, 'release-notes.md'), notes)
    const script = fileURLToPath(new URL('./github-desktop-release.mjs', import.meta.url))
    const runPreflight = (cloudUrl: string) =>
      spawnSync(process.execPath, [script, 'preflight'], {
        cwd: directory,
        encoding: 'utf8',
        env: { ...process.env, GITHUB_REPOSITORY: repository, GITHUB_SHA: sha, PURECHAT_DESKTOP_CLOUD_URL: cloudUrl },
      })
    const valid = runPreflight(config.cloudUrl)
    expect(valid.status).toBe(0)
    expect(valid.stdout).toBe(`${version}\n`)
    const invalid = runPreflight('not-a-url')
    expect(invalid.status).toBe(1)
    expect(invalid.stdout).toBe('')
    expect(invalid.stderr).toContain('PURECHAT_DESKTOP_CLOUD_URL')
    writeFileSync(path.join(notesDir, 'release-notes.md'), '')
    const emptyNotes = runPreflight(config.cloudUrl)
    expect(emptyNotes.status).toBe(1)
    expect(emptyNotes.stderr).toContain('发行说明不能为空')
  })
})

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

  it('does not write a Release when fetching the remote tag fails', () => {
    createArtifacts()
    const run = fakeCommands()
    run.mockImplementation((command) => {
      if (command === 'git') throw new Error('git authentication failed')
      return '[[]]'
    })
    expect(() => writeDesktopDraft({ directory, version, repository, sha, notes }, run)).toThrow(
      'authentication failed'
    )
    expect(run.mock.calls.some(([, args]) => args[0] === 'release')).toBe(false)
  })

  it('fails on insufficient Release permissions without uploading files and cleans temporary notes', () => {
    createArtifacts()
    const run = fakeCommands()
    let notesFile = ''
    run.mockImplementation((command, args) => {
      if (command === 'git') return ''
      if (args[0] === 'api') return '[[]]'
      notesFile = args[args.indexOf('--notes-file') + 1]
      throw new Error('Resource not accessible by integration (403)')
    })
    expect(() => writeDesktopDraft({ directory, version, repository, sha, notes }, run)).toThrow('403')
    expect(run.mock.calls.some(([, args]) => args[1] === 'upload')).toBe(false)
    expect(existsSync(notesFile)).toBe(false)
  })

  it('reports upload failure and leaves publication to a same-commit retry', () => {
    createArtifacts()
    const run = fakeCommands([draft])
    let notesFile = ''
    run.mockImplementation((command, args) => {
      if (command === 'git') return ''
      if (args[0] === 'api') return JSON.stringify([[draft]])
      if (args[1] === 'edit') notesFile = args[args.indexOf('--notes-file') + 1]
      if (args[1] === 'upload') throw new Error('artifact upload failed')
      return ''
    })
    expect(() => writeDesktopDraft({ directory, version, repository, sha, notes }, run)).toThrow('upload failed')
    expect(run.mock.calls.some(([, args]) => args.includes('--draft'))).toBe(false)
    expect(existsSync(notesFile)).toBe(false)
  })
})
