import { describe, expect, it } from 'vitest'

import { mapMarketSkillToDiscoverItem } from '../../../scripts/map-community-skill'

describe('mapMarketSkillToDiscoverItem', () => {
  it('maps marketplace list fields and drops empty optional values', () => {
    const result = mapMarketSkillToDiscoverItem({
      author: 'anthropics',
      category: 'pdf-documents',
      commentCount: 12,
      createdAt: '2026-02-12T13:15:02.445Z',
      description: '  Extract text from PDF files.  ',
      github: { stars: 100, url: 'https://github.com/anthropics/skills' },
      homepage: ' https://github.com/anthropics/skills/tree/main/skills/pdf ',
      icon: 'https://github.com/anthropics.png',
      identifier: 'anthropics-skills-pdf',
      installCount: 2500,
      isFeatured: true,
      license: 'MIT',
      name: 'pdf',
      ratingAvg: 4.8,
      resourcesCount: 3,
      tags: ['PDF', ' ', 'docs'],
      updatedAt: '2026-09-17T00:49:52.221Z',
      version: '1.2.0',
    })

    expect(result).toEqual({
      author: 'anthropics',
      category: 'pdf-documents',
      description: 'Extract text from PDF files.',
      github: { stars: 100, url: 'https://github.com/anthropics/skills' },
      homepage: 'https://github.com/anthropics/skills/tree/main/skills/pdf',
      icon: 'https://github.com/anthropics.png',
      identifier: 'anthropics-skills-pdf',
      isFeatured: true,
      license: 'MIT',
      name: 'pdf',
      resourcesCount: 3,
      tags: ['PDF', 'docs'],
      updatedAt: '2026-09-17T00:49:52.221Z',
      version: '1.2.0',
    })
  })

  it('returns null when required fields or category are missing', () => {
    expect(
      mapMarketSkillToDiscoverItem({
        category: 'not-a-real-category',
        description: 'x',
        identifier: 'id',
        name: 'n',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    ).toBeNull()

    expect(
      mapMarketSkillToDiscoverItem({
        category: 'pdf-documents',
        identifier: 'id',
        name: 'n',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    ).toBeNull()
  })
})
