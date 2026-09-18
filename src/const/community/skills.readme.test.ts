import { describe, expect, it } from 'vitest'

import { getCommunitySkillReadmeSnapshot } from './skills.readme'

describe('getCommunitySkillReadmeSnapshot', () => {
  it('returns undefined for identifiers not captured by sync', () => {
    expect(getCommunitySkillReadmeSnapshot('missing-skill')).toBeUndefined()
  })

  it('returns captured markdown for a synced catalog skill', () => {
    const markdown = getCommunitySkillReadmeSnapshot('openclaw-openclaw-skill-creator')
    expect(markdown).toEqual(expect.stringContaining('skill'))
  })
})
