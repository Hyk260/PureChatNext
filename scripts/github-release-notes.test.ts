// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { extractChangelogNotes, parseReleaseTag, prepareReleaseNotes } from './github-release-notes.mjs'

const CHANGELOG = `# 更新日志

## Unreleased

- 未发布

## 0.2.8

- 修复发版 notes
- 校验 tag 与版本号

## 0.2.7

- 旧版本
`

describe('parseReleaseTag', () => {
  it('accepts vX.Y.Z', () => {
    expect(parseReleaseTag('v0.2.8')).toBe('0.2.8')
  })

  it('rejects loose v* tags', () => {
    expect(() => parseReleaseTag('vfoo')).toThrow('vX.Y.Z')
    expect(() => parseReleaseTag('0.2.8')).toThrow('vX.Y.Z')
  })
})

describe('extractChangelogNotes', () => {
  it('returns the matching section without the heading', () => {
    expect(extractChangelogNotes(CHANGELOG, '0.2.8')).toBe('- 修复发版 notes\n- 校验 tag 与版本号')
  })

  it('fails when the section is missing or empty', () => {
    expect(() => extractChangelogNotes(CHANGELOG, '0.2.9')).toThrow('缺少「## 0.2.9」')
    expect(() => extractChangelogNotes('## 0.2.8\n\n## 0.2.7\n- x\n', '0.2.8')).toThrow('为空')
  })
})

describe('prepareReleaseNotes', () => {
  it('requires tag to match package.json', () => {
    expect(() =>
      prepareReleaseNotes({ changelog: CHANGELOG, packageVersion: '0.2.7', tag: 'v0.2.8' }),
    ).toThrow('不一致')
  })

  it('returns changelog notes when versions match', () => {
    expect(prepareReleaseNotes({ changelog: CHANGELOG, packageVersion: '0.2.8', tag: 'v0.2.8' })).toBe(
      '- 修复发版 notes\n- 校验 tag 与版本号',
    )
  })
})
