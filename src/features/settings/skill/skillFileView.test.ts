import { describe, expect, it } from 'vitest'

import { getSkillFilePreviewKind } from '@/const/community/skillFilePreview'

import { buildFileTree } from './skillFileView'

describe('buildFileTree', () => {
  it('nests paths under directories', () => {
    expect(buildFileTree(['LICENSE', 'SKILL.md', 'scripts/run.sh', 'scripts/lib/util.py'])).toEqual([
      { name: 'SKILL.md', path: 'SKILL.md' },
      {
        children: [
          {
            children: [{ name: 'util.py', path: 'scripts/lib/util.py' }],
            name: 'lib',
            path: 'scripts/lib',
          },
          { name: 'run.sh', path: 'scripts/run.sh' },
        ],
        name: 'scripts',
        path: 'scripts',
      },
    ])
  })
})

describe('getSkillFilePreviewKind', () => {
  it('classifies markdown, images, text, and binary', () => {
    expect(getSkillFilePreviewKind('SKILL.md')).toBe('markdown')
    expect(getSkillFilePreviewKind('assets/icon.png')).toBe('image')
    expect(getSkillFilePreviewKind('scripts/run.sh')).toBe('text')
    expect(getSkillFilePreviewKind('bin/tool.wasm')).toBe('binary')
  })
})
