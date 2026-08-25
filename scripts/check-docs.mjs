#!/usr/bin/env node
/**
 * 校验公开文档目录结构、本地链接和索引可达性。
 *
 * 用法：`pnpm run lint:docs`
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const DOCS_ROOT = path.join(ROOT, 'docs')
const DOCS_INDEX = path.join(DOCS_ROOT, 'README.md')
const META_FILENAME = 'meta.json'
const PUBLIC_SECTIONS = new Set(['development', 'getting-started', 'self-hosting'])

function walk(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (directory === DOCS_ROOT && entry.name === 'private') continue

    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(absolutePath, files)
      continue
    }

    if (entry.name.endsWith('.md')) files.push(absolutePath)
  }

  return files
}

function relativePath(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}

function readFrontmatter(markdown) {
  const lines = markdown.split(/\r?\n/)
  if (lines[0] !== '---') return

  const end = lines.indexOf('---', 1)
  if (end < 0) return

  const values = {}
  for (const line of lines.slice(1, end)) {
    const match = line.match(/^(title|description):\s*(.+?)\s*$/)
    if (!match) continue
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2').trim()
  }

  return values
}

function routeForDoc(file) {
  const relative = path.relative(DOCS_ROOT, file)
  const segments = relative.split(path.sep)
  const filename = segments.pop().replace(/\.md$/, '')
  if (filename !== 'README') segments.push(filename)
  return `/${segments.join('/')}`
}

function walkMeta(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (directory === DOCS_ROOT && entry.name === 'private') continue

    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) walkMeta(absolutePath, files)
    else if (entry.name === META_FILENAME) files.push(absolutePath)
  }

  return files
}

function withoutFencedCode(markdown) {
  const output = []
  let fence

  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\s*(`{3,}|~{3,})/)
    if (match) {
      const marker = match[1][0]
      if (!fence) fence = marker
      else if (fence === marker) fence = undefined
      continue
    }

    if (!fence) output.push(line)
  }

  return output.join('\n')
}

function linkTargets(markdown) {
  const source = withoutFencedCode(markdown).replace(/`[^`\n]*`/g, '')
  const targets = []
  const inlineLink = /!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/g
  const referenceLink = /^\s*\[[^\]]+\]:\s*(?:<([^>]+)>|(\S+))/gm

  for (const expression of [inlineLink, referenceLink]) {
    let match
    while ((match = expression.exec(source)) !== null) targets.push(match[1] || match[2])
  }

  return targets
}

function isExternalLink(target) {
  return (
    target.startsWith('/') ||
    target.startsWith('#') ||
    /^[a-z][a-z\d+.-]*:/i.test(target)
  )
}

function resolveLink(sourceFile, target) {
  if (!target || isExternalLink(target)) return

  const [pathname, fragment] = target.split('#', 2)
  if (!pathname) return

  let decodedPath
  try {
    decodedPath = decodeURIComponent(pathname.split('?', 1)[0])
  } catch {
    decodedPath = pathname.split('?', 1)[0]
  }

  return {
    absolutePath: path.resolve(path.dirname(sourceFile), decodedPath),
    fragment,
  }
}

function headingSlugs(markdown) {
  const slugs = new Set()
  const occurrences = new Map()

  for (const line of withoutFencedCode(markdown).split(/\r?\n/)) {
    const match = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/)
    if (!match) continue

    const base = match[1]
      .replace(/\\([_*-])/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[`'"“”‘’。，、：；！？（）【】《》]/g, '')
      .toLocaleLowerCase()
      .trim()
      .replace(/[^\p{L}\p{M}\p{N}_ -]/gu, '')
      .replace(/\s+/g, '-')

    const count = occurrences.get(base) || 0
    occurrences.set(base, count + 1)
    slugs.add(count === 0 ? base : `${base}-${count}`)
  }

  return slugs
}

function main() {
  const failures = []

  if (!existsSync(DOCS_INDEX)) {
    console.error('❌ 缺少 docs/README.md')
    process.exit(1)
  }

  const publicDocs = walk(DOCS_ROOT).sort()
  const publicMeta = walkMeta(DOCS_ROOT).sort()
  const publicDocSet = new Set(publicDocs.map((file) => path.resolve(file)))
  const publicMetaSet = new Set(publicMeta.map((file) => path.resolve(file)))
  const graph = new Map(publicDocs.map((file) => [path.resolve(file), new Set()]))
  const slugCache = new Map()
  const routes = new Map()

  for (const file of publicDocs) {
    const relativeToDocs = path.relative(DOCS_ROOT, file)
    const segments = relativeToDocs.split(path.sep)

    if (segments.length === 1 && segments[0] !== 'README.md') {
      failures.push(`${relativePath(file)}：docs 根目录只允许 README.md`)
    }
    if (segments.length > 1 && !PUBLIC_SECTIONS.has(segments[0])) {
      failures.push(`${relativePath(file)}：不属于允许的公开文档分类`)
    }
    if (file.endsWith('.zh-CN.md')) {
      failures.push(`${relativePath(file)}：单语言公开文档不得使用 locale 后缀`)
    }

    const markdown = readFileSync(file, 'utf8')
    const frontmatter = readFrontmatter(markdown)
    if (!frontmatter) failures.push(`${relativePath(file)}：缺少文件开头的 YAML frontmatter`)
    else {
      if (!frontmatter.title) failures.push(`${relativePath(file)}：frontmatter 缺少 title`)
      if (!frontmatter.description) failures.push(`${relativePath(file)}：frontmatter 缺少 description`)
    }

    const route = routeForDoc(file)
    const existingRoute = routes.get(route)
    if (existingRoute) failures.push(`${relativePath(file)}：公开 URL ${route} 与 ${existingRoute} 冲突`)
    else routes.set(route, relativePath(file))

    for (const target of linkTargets(markdown)) {
      const resolved = resolveLink(file, target)
      if (!resolved) continue

      if (!existsSync(resolved.absolutePath)) {
        failures.push(`${relativePath(file)}：链接目标不存在：${target}`)
        continue
      }

      if (resolved.fragment && statSync(resolved.absolutePath).isFile()) {
        const targetMarkdown = readFileSync(resolved.absolutePath, 'utf8')
        let slugs = slugCache.get(resolved.absolutePath)
        if (!slugs) {
          slugs = headingSlugs(targetMarkdown)
          slugCache.set(resolved.absolutePath, slugs)
        }

        let fragment = resolved.fragment
        try {
          fragment = decodeURIComponent(fragment)
        } catch {}
        if (!slugs.has(fragment.toLocaleLowerCase())) {
          failures.push(`${relativePath(file)}：链接锚点不存在：${target}`)
        }
      }

      const targetPath = path.resolve(resolved.absolutePath)
      if (publicDocSet.has(targetPath)) graph.get(path.resolve(file)).add(targetPath)
    }
  }

  const publicDirectories = new Set(publicDocs.map((file) => path.dirname(file)))
  for (const directory of publicDirectories) {
    const metaPath = path.join(directory, META_FILENAME)
    if (!publicMetaSet.has(metaPath)) failures.push(`${relativePath(directory)}：缺少 ${META_FILENAME}`)
  }

  for (const metaFile of publicMeta) {
    let meta
    try {
      meta = JSON.parse(readFileSync(metaFile, 'utf8'))
    } catch (error) {
      failures.push(`${relativePath(metaFile)}：JSON 无效（${error.message}）`)
      continue
    }

    if (!meta.title || typeof meta.title !== 'string') {
      failures.push(`${relativePath(metaFile)}：缺少字符串 title`)
    }
    if (!Array.isArray(meta.pages)) {
      failures.push(`${relativePath(metaFile)}：缺少 pages 导航顺序`)
      continue
    }
    if (JSON.stringify(meta).includes('private')) {
      failures.push(`${relativePath(metaFile)}：公开导航不得引用 private`)
    }

    const directory = path.dirname(metaFile)
    const available = new Set()
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'private' || entry.name === META_FILENAME) continue
      if (entry.isDirectory()) available.add(entry.name)
      else if (entry.name.endsWith('.md')) available.add(entry.name.replace(/\.md$/, ''))
    }

    const declared = new Set(meta.pages.filter((item) => typeof item === 'string' && !item.startsWith('---')))
    for (const item of declared) {
      if (!available.has(item)) failures.push(`${relativePath(metaFile)}：pages 引用了不存在的条目：${item}`)
    }
    for (const item of available) {
      if (!declared.has(item)) failures.push(`${relativePath(metaFile)}：pages 未包含直属条目：${item}`)
    }
    if (meta.pagesIndex && !available.has(meta.pagesIndex)) {
      failures.push(`${relativePath(metaFile)}：pagesIndex 引用了不存在的条目：${meta.pagesIndex}`)
    }
  }

  const reachable = new Set()
  const queue = [path.resolve(DOCS_INDEX)]
  while (queue.length > 0) {
    const current = queue.shift()
    if (reachable.has(current)) continue
    reachable.add(current)
    for (const target of graph.get(current) || []) queue.push(target)
  }

  for (const file of publicDocSet) {
    if (!reachable.has(file)) failures.push(`${relativePath(file)}：未从 docs/README.md 索引到`)
  }

  console.log(`🔍 Public docs check: ${publicDocs.length} Markdown files, ${publicMeta.length} navigation files`)
  if (failures.length > 0) {
    console.error('❌ 公开文档检查失败：')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exit(1)
  }

  console.log('✅ 文档结构、链接和索引检查通过')
}

main()
