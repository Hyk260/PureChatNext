import { createNanoId } from '@pure/utils'
import { generate } from 'random-words'

const prefixes = {
  topics: 'tpc',
  documents: 'docs',
  sessions: 'ssn',
  tasks: 'task',
  agents: 'agt',
  user: 'user',
  files: 'file',
  knowledgeBases: 'kb',
} as const

export const idGenerator = (namespace: keyof typeof prefixes, size = 12) => {
  const hash = createNanoId(size)
  const prefix = prefixes[namespace]
  return `${prefix}_${hash()}`
}

export const randomSlug = (count = 2) => (generate(count) as string[]).join('-')

export const inboxSessionId = (userId: string) => `ssn_inbox_${userId}`
