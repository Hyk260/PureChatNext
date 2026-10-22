export type FileTabsState = { activePath: string | null; paths: string[] }
export type FileTabsAction =
  { type: 'open'; path: string } | { type: 'close'; path: string } | { type: 'closeOthers' } | { type: 'closeAll' }

export const EMPTY_FILE_TABS: FileTabsState = { activePath: null, paths: [] }

export function fileTabsReducer(state: FileTabsState, action: FileTabsAction): FileTabsState {
  if (action.type === 'closeAll') return EMPTY_FILE_TABS
  if (action.type === 'closeOthers') {
    return { activePath: state.activePath, paths: state.activePath ? [state.activePath] : [] }
  }
  if (action.type === 'open') {
    const paths = state.paths.includes(action.path) ? state.paths : [...state.paths, action.path]
    return { activePath: action.path, paths }
  }
  const index = state.paths.indexOf(action.path)
  if (index < 0) return state
  const paths = state.paths.filter((path) => path !== action.path)
  const activePath = state.activePath === action.path ? (paths[Math.max(0, index - 1)] ?? null) : state.activePath
  return { activePath, paths }
}

type PreviewLanguage = { label: string; mode: string }

const LANGUAGE_EXTENSIONS: Record<string, PreviewLanguage> = {
  ts: { label: 'TypeScript', mode: 'typescript' },
  mts: { label: 'TypeScript', mode: 'typescript' },
  cts: { label: 'TypeScript', mode: 'typescript' },
  tsx: { label: 'TypeScript React', mode: 'tsx' },
  js: { label: 'JavaScript', mode: 'javascript' },
  mjs: { label: 'JavaScript', mode: 'javascript' },
  cjs: { label: 'JavaScript', mode: 'javascript' },
  jsx: { label: 'JavaScript React', mode: 'jsx' },
  json: { label: 'JSON', mode: 'json' },
  jsonc: { label: 'JSON', mode: 'json' },
  css: { label: 'CSS', mode: 'css' },
  scss: { label: 'SCSS', mode: 'sass' },
  html: { label: 'HTML', mode: 'html' },
  vue: { label: 'Vue', mode: 'vue' },
  xml: { label: 'XML', mode: 'xml' },
  svg: { label: 'SVG', mode: 'xml' },
  md: { label: 'Markdown', mode: '' },
  mdx: { label: 'MDX', mode: '' },
  yml: { label: 'YAML', mode: 'yaml' },
  yaml: { label: 'YAML', mode: 'yaml' },
  toml: { label: 'TOML', mode: 'toml' },
  py: { label: 'Python', mode: 'python' },
  go: { label: 'Go', mode: 'go' },
  rs: { label: 'Rust', mode: 'rust' },
  java: { label: 'Java', mode: 'java' },
  c: { label: 'C', mode: 'c' },
  cpp: { label: 'C++', mode: 'cpp' },
  sh: { label: 'Shell', mode: 'shell' },
  bash: { label: 'Shell', mode: 'shell' },
  sql: { label: 'SQL', mode: 'sql' },
}

const LANGUAGE_FILENAMES: Record<string, PreviewLanguage> = {
  dockerfile: { label: 'Dockerfile', mode: 'dockerfile' },
  makefile: { label: 'Makefile', mode: 'makefile' },
  '.env': { label: 'Dotenv', mode: 'properties' },
  '.gitignore': { label: 'Ignore', mode: 'properties' },
  '.editorconfig': { label: 'EditorConfig', mode: 'properties' },
}

export function getPreviewLanguage(filePath: string): PreviewLanguage {
  const name = filePath.split(/[/\\]/).at(-1)?.toLowerCase() ?? ''
  const named = LANGUAGE_FILENAMES[name]
  if (named) return named
  const extension = name.includes('.') ? (name.split('.').at(-1) ?? '') : ''
  if (LANGUAGE_EXTENSIONS[extension]) return LANGUAGE_EXTENSIONS[extension]
  if (name.startsWith('.env.')) return LANGUAGE_FILENAMES['.env']!
  return { label: '纯文本', mode: '' }
}

export function detectFileIndent(content: string) {
  const steps = new Map<number, number>()
  let tabLines = 0
  let spaceLines = 0
  let previous = 0
  for (const line of content.split('\n', 400)) {
    if (/^\s*\*/.test(line) || !line.trim()) continue
    const indent = /^[\t ]*/.exec(line)?.[0] ?? ''
    if (indent.includes('\t')) {
      tabLines++
      continue
    }
    if (indent.length) {
      spaceLines++
      const step = indent.length - previous
      if (step > 0 && step <= 8) steps.set(step, (steps.get(step) ?? 0) + 1)
    }
    previous = indent.length
  }
  const size = [...steps].sort(([a, countA], [b, countB]) => countB - countA || a - b)[0]?.[0] ?? 2
  return tabLines > spaceLines ? { size: 4, useTabs: true } : { size, useTabs: false }
}

export function getTextCursor(content: string, offset: number) {
  const before = content.slice(0, offset)
  const line = before.split('\n').length
  return { column: offset - before.lastIndexOf('\n'), line }
}

export function getProjectFilePath(root: string, relativePath: string) {
  const separator = root.includes('\\') ? '\\' : '/'
  return `${root.replace(/[/\\]+$/, '')}${separator}${relativePath.split('/').join(separator)}`
}
