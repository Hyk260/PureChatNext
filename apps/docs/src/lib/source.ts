import { loader } from 'fumadocs-core/source'
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons'
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema'
import { defineDocs } from 'fumadocs-mdx/macro'

const docs = defineDocs({
  dir: '../../docs',
  docs: {
    files: ['**/*.md', '!private/**'],
    schema: pageSchema,
  },
  meta: {
    files: ['**/meta.json', '!private/**'],
    schema: metaSchema,
  },
})

export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
  slugs(file, next) {
    const slugs = next()
    if (file.path === 'README.md' || file.path.endsWith('/README.md')) return slugs.slice(0, -1)
    return slugs
  },
  url(slugs) {
    return `/${slugs.join('/')}`
  },
})

export function getGitHubEditUrl(path: string) {
  return `https://github.com/Hyk260/PureChatNext/edit/main/docs/${path}`
}
