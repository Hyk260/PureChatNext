const MARKDOWN_EXTENSIONS = new Set(['md', 'mdx', 'markdown'])
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'])
const TEXT_EXTENSIONS = new Set([
  'txt',
  'json',
  'yml',
  'yaml',
  'js',
  'ts',
  'tsx',
  'jsx',
  'mjs',
  'cjs',
  'py',
  'sh',
  'bash',
  'zsh',
  'toml',
  'xml',
  'html',
  'css',
  'rs',
  'go',
  'rb',
  'php',
  'sql',
  'env',
])

export type SkillFilePreviewKind = 'binary' | 'image' | 'markdown' | 'text'

export const getSkillFileExtension = (path: string) => {
  const base = path.split('/').pop() ?? path
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot + 1).toLowerCase()
}

export const getSkillFilePreviewKind = (path: string): SkillFilePreviewKind => {
  const extension = getSkillFileExtension(path)
  if (MARKDOWN_EXTENSIONS.has(extension)) return 'markdown'
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (TEXT_EXTENSIONS.has(extension)) return 'text'
  return 'binary'
}
