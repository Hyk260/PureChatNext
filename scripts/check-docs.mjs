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
  const publicDocSet = new Set(publicDocs.map((file) => path.resolve(file)))
  const graph = new Map(publicDocs.map((file) => [path.resolve(file), new Set()]))
  const slugCache = new Map()

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

  console.log(`🔍 Public docs check: ${publicDocs.length} Markdown files`)
  if (failures.length > 0) {
    console.error('❌ 公开文档检查失败：')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exit(1)
  }

  console.log('✅ 文档结构、链接和索引检查通过')
}

main()
