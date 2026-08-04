export type PreviewKind = 'audio' | 'image' | 'pdf' | 'text' | 'unsupported' | 'video'

const IMAGE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'webp'])
const VIDEO_EXTENSIONS = new Set(['m4v', 'mov', 'mp4', 'ogv', 'webm'])
const AUDIO_EXTENSIONS = new Set(['aac', 'flac', 'm4a', 'mp3', 'oga', 'ogg', 'opus', 'wav'])

const TEXT_EXTENSIONS = new Set([
  'bash',
  'bat',
  'bbl',
  'bib',
  'c',
  'cc',
  'cjs',
  'cfg',
  'clj',
  'cljc',
  'cljs',
  'cls',
  'conf',
  'cpp',
  'cs',
  'css',
  'cts',
  'csv',
  'cxx',
  'dart',
  'db',
  'diff',
  'dockerfile',
  'env',
  'erl',
  'ex',
  'exs',
  'go',
  'gradle',
  'graphql',
  'groovy',
  'gql',
  'h',
  'hpp',
  'hrl',
  'htm',
  'html',
  'hxx',
  'ini',
  'java',
  'js',
  'json',
  'json5',
  'jsonc',
  'jsx',
  'kt',
  'kts',
  'less',
  'log',
  'lua',
  'markdown',
  'md',
  'mdx',
  'mjs',
  'mts',
  'patch',
  'php',
  'properties',
  'ps1',
  'py',
  'pyw',
  'r',
  'rb',
  'rs',
  'sass',
  'scala',
  'scss',
  'sh',
  'sql',
  'sty',
  'svelte',
  'svg',
  'swift',
  'tex',
  'toml',
  'ts',
  'tsx',
  'txt',
  'vim',
  'vue',
  'xml',
  'yaml',
  'yml',
  'zsh',
])

const TEXT_MIME_TYPES = new Set([
  'application/graphql',
  'application/javascript',
  'application/json',
  'application/ld+json',
  'application/sql',
  'application/typescript',
  'application/xhtml+xml',
  'application/xml',
  'application/x-httpd-php',
  'application/x-javascript',
  'application/x-sh',
  'application/x-yaml',
])

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  bash: 'bash',
  bat: 'bat',
  bbl: 'bibtex',
  bib: 'bibtex',
  c: 'c',
  cjs: 'javascript',
  clj: 'clojure',
  cljc: 'clojure',
  cljs: 'clojure',
  cls: 'latex',
  cpp: 'cpp',
  cs: 'csharp',
  css: 'css',
  cts: 'typescript',
  dart: 'dart',
  diff: 'diff',
  dockerfile: 'dockerfile',
  env: 'dotenv',
  erl: 'erlang',
  ex: 'elixir',
  exs: 'elixir',
  go: 'go',
  graphql: 'graphql',
  groovy: 'groovy',
  gql: 'graphql',
  h: 'cpp',
  hpp: 'cpp',
  htm: 'html',
  html: 'html',
  hxx: 'cpp',
  ini: 'ini',
  java: 'java',
  js: 'javascript',
  json: 'json',
  json5: 'json',
  jsonc: 'json',
  jsx: 'jsx',
  kt: 'kotlin',
  kts: 'kotlin',
  less: 'less',
  log: 'log',
  lua: 'lua',
  markdown: 'markdown',
  md: 'markdown',
  mdx: 'markdown',
  mjs: 'javascript',
  mts: 'typescript',
  patch: 'diff',
  php: 'php',
  ps1: 'powershell',
  py: 'python',
  pyw: 'python',
  r: 'r',
  rb: 'ruby',
  rs: 'rust',
  sass: 'sass',
  scala: 'scala',
  scss: 'scss',
  sh: 'bash',
  sql: 'sql',
  sty: 'latex',
  svelte: 'svelte',
  swift: 'swift',
  tex: 'latex',
  toml: 'toml',
  ts: 'typescript',
  tsx: 'tsx',
  txt: 'txt',
  vim: 'viml',
  vue: 'vue',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  zsh: 'bash',
}

const normalizeFileType = (fileType?: string | null) => fileType?.split(';')[0].trim().toLowerCase() ?? ''

export const getFileExtension = (fileName?: string | null): string => {
  if (!fileName) return ''

  const normalizedName = fileName.toLowerCase().split(/[\\/]/).pop() ?? ''
  const extensionIndex = normalizedName.lastIndexOf('.')

  return extensionIndex > 0 ? normalizedName.slice(extensionIndex + 1) : normalizedName
}

export const getPreviewKind = ({ fileType, name }: { fileType?: string | null; name?: string | null }): PreviewKind => {
  const normalizedFileType = normalizeFileType(fileType)
  const extension = getFileExtension(name)

  if (normalizedFileType === 'application/pdf' || normalizedFileType === 'pdf' || extension === 'pdf') return 'pdf'

  if (
    normalizedFileType.startsWith('image/') ||
    IMAGE_EXTENSIONS.has(normalizedFileType) ||
    IMAGE_EXTENSIONS.has(extension)
  ) {
    return 'image'
  }

  if (
    normalizedFileType.startsWith('video/') ||
    VIDEO_EXTENSIONS.has(normalizedFileType) ||
    VIDEO_EXTENSIONS.has(extension)
  ) {
    return 'video'
  }

  if (
    normalizedFileType.startsWith('audio/') ||
    AUDIO_EXTENSIONS.has(normalizedFileType) ||
    AUDIO_EXTENSIONS.has(extension)
  ) {
    return 'audio'
  }

  if (
    normalizedFileType.startsWith('text/') ||
    TEXT_MIME_TYPES.has(normalizedFileType) ||
    TEXT_EXTENSIONS.has(normalizedFileType) ||
    TEXT_EXTENSIONS.has(extension)
  ) {
    return 'text'
  }

  return 'unsupported'
}

export const getLanguageFromFileName = (fileName?: string | null): string => {
  const extension = getFileExtension(fileName)
  return LANGUAGE_BY_EXTENSION[extension] ?? 'txt'
}
