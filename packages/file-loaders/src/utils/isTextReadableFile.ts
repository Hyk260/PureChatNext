export const TEXT_READABLE_FILE_TYPES = [
  // Plain Text & Markup
  'txt',
  'md',
  'markdown',
  'mdx',

  // Configuration & Data
  'json',
  'jsonc',
  'json5',
  'xml',
  'yaml',
  'yml',
  'toml',
  'ini',
  'cfg',
  'conf',
  'csv',
  'env',
  'properties',

  // Web Development
  'html',
  'htm',
  'css',
  'scss',
  'less',
  'js',
  'jsx',
  'ts',
  'tsx',
  'mjs',
  'cjs',
  'mts',
  'cts',
  'vue',
  'svelte',
  'svg',

  // Scripting & Programming
  'php',
  'py',
  'rb',
  'java',
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'go',
  'rs',
  'swift',
  'kt',
  'sh',
  'bash',
  'bat',
  'ps1',
  'lua',
  'dart',
  'scala',
  'groovy',
  'gradle',

  // LaTeX & Academic
  'tex',
  'sty',
  'cls',
  'bib',
  'bbl',

  // Other
  'log',
  'sql',
  'patch',
  'diff',
  'db', // often text-adjacent (e.g. SQLite journals)
]

/**
 * Binary formats with dedicated parsers in `loadFile` (not plain text).
 */
export const SPECIAL_PARSED_FILE_TYPES = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'pptx']

/**
 * Whether `fileType` (extension without dot) is likely plain text.
 */
export function isTextReadableFile(fileType: string): boolean {
  return TEXT_READABLE_FILE_TYPES.includes(fileType.toLowerCase())
}

/**
 * Whether agent/tool `readFile` should attempt this extension at all.
 * Includes text types and formats with dedicated loaders; rejects opaque
 * binaries (`.bin`, `.zip`, `.exe`, …) before opening them for the LLM.
 */
export function isReadableFileType(fileType: string): boolean {
  const ext = fileType.toLowerCase()
  return TEXT_READABLE_FILE_TYPES.includes(ext) || SPECIAL_PARSED_FILE_TYPES.includes(ext)
}
