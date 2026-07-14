import  { createNanoId } from '@pure/utils'

const prefixes = {
  chatTopics: 'topic',
  documents: 'docs',
  files: 'file',
  knowledgeBases: 'kb',
} as const

export const idGenerator = (namespace: keyof typeof prefixes, size = 12) => {
  const hash = createNanoId(size)
  const prefix = prefixes[namespace]
  return `${prefix}_${hash()}`
}

const SLUG_WORDS = [
  'alpha',
  'beta',
  'gamma',
  'delta',
  'echo',
  'foxtrot',
  'golf',
  'hotel',
  'india',
  'juliet',
]

export const randomSlug = (count = 2) => {
  const words: string[] = []
  for (let i = 0; i < count; i++) {
    words.push(SLUG_WORDS[Math.floor(Math.random() * SLUG_WORDS.length)]!)
  }
  return words.join('-')
}
