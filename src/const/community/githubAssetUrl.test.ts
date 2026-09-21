import { describe, expect, it } from 'vitest'

import {
  GITHUB_ASSET_PROXY_PATH,
  githubAssetAvatar,
  githubAssetFetchUrls,
  githubAssetUrl,
  githubSourceFetchUrls,
  parseGithubAssetUrl,
} from './githubAssetUrl'

describe('parseGithubAssetUrl', () => {
  it('accepts GitHub user avatars', () => {
    expect(parseGithubAssetUrl('https://github.com/openclaw.png')?.hostname).toBe('github.com')
    expect(parseGithubAssetUrl('https://github.com/MiniMax-AI.png?size=40')?.pathname).toBe('/MiniMax-AI.png')
    expect(parseGithubAssetUrl('https://avatars.githubusercontent.com/u/1?v=4')?.hostname).toBe(
      'avatars.githubusercontent.com'
    )
  })

  it('rejects pages, credentials, and non-https hosts', () => {
    expect(parseGithubAssetUrl('https://github.com/openclaw/skills')).toBeNull()
    expect(parseGithubAssetUrl('http://github.com/openclaw.png')).toBeNull()
    expect(parseGithubAssetUrl('https://user:pass@github.com/openclaw.png')).toBeNull()
    expect(parseGithubAssetUrl('https://evil.example/openclaw.png')).toBeNull()
    expect(parseGithubAssetUrl('not-a-url')).toBeNull()
  })
})

describe('githubAssetUrl', () => {
  it('rewrites GitHub avatars through the same-origin proxy', () => {
    expect(githubAssetUrl('https://github.com/openclaw.png')).toBe(
      `${GITHUB_ASSET_PROXY_PATH}?url=${encodeURIComponent('https://github.com/openclaw.png')}`
    )
  })

  it('passes through names and non-GitHub URLs', () => {
    expect(githubAssetUrl('技能名')).toBe('技能名')
    expect(githubAssetUrl('https://cdn.example/icon.png')).toBe('https://cdn.example/icon.png')
    expect(githubAssetUrl(null)).toBeUndefined()
  })
})

describe('githubAssetAvatar', () => {
  it('falls back to the skill name when icon is missing', () => {
    expect(githubAssetAvatar(null, 'Demo')).toBe('Demo')
    expect(githubAssetAvatar('https://github.com/openclaw.png', 'Demo')).toContain(GITHUB_ASSET_PROXY_PATH)
  })
})

describe('githubAssetFetchUrls', () => {
  it('uses the configured mirror first when GITHUB_PROXY is set', () => {
    expect(githubAssetFetchUrls('https://github.com/openclaw.png', 'https://ghfast.top')).toEqual([
      'https://ghfast.top/https://github.com/openclaw.png',
      'https://avatars.githubusercontent.com/openclaw',
      'https://wsrv.nl/?url=github.com%2Fopenclaw.png',
      'https://github.com/openclaw.png',
    ])
  })

  it('prefers GitHub avatar CDN and wsrv.nl over github.com', () => {
    expect(githubAssetFetchUrls('https://github.com/openclaw.png')).toEqual([
      'https://avatars.githubusercontent.com/openclaw',
      'https://wsrv.nl/?url=github.com%2Fopenclaw.png',
      'https://github.com/openclaw.png',
    ])
  })
})

describe('githubSourceFetchUrls', () => {
  it('uses the configured mirror first, then origin', () => {
    expect(githubSourceFetchUrls('https://raw.githubusercontent.com/o/r/main/SKILL.md', 'https://ghfast.top')).toEqual([
      'https://ghfast.top/https://raw.githubusercontent.com/o/r/main/SKILL.md',
      'https://raw.githubusercontent.com/o/r/main/SKILL.md',
    ])
  })

  it('keeps origin only when no proxy is set', () => {
    expect(githubSourceFetchUrls('https://api.github.com/repos/o/r/contents')).toEqual([
      'https://api.github.com/repos/o/r/contents',
    ])
  })
})
