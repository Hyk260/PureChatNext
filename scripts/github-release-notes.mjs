#!/usr/bin/env node
/**
 * 校验 git tag 与 package.json 版本一致，并抽出 CHANGELOG 对应章节作为 Release notes。
 *
 * 用法：`node scripts/github-release-notes.mjs v0.2.8`
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const TAG_PATTERN = /^v(\d+\.\d+\.\d+)$/

export function parseReleaseTag(tag) {
  const matched = TAG_PATTERN.exec(tag)
  if (!matched) {
    throw new Error(`tag 必须是 vX.Y.Z，收到 ${tag}`)
  }
  return matched[1]
}

export function extractChangelogNotes(changelog, version) {
  const heading = `## ${version}`
  const lines = changelog.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start < 0) {
    throw new Error(`CHANGELOG.md 缺少「${heading}」章节`)
  }

  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('## ')) {
      end = index
      break
    }
  }

  const notes = lines.slice(start + 1, end).join('\n').trim()
  if (!notes) {
    throw new Error(`CHANGELOG.md「${heading}」章节为空`)
  }
  return notes
}

export function prepareReleaseNotes({ changelog, packageVersion, tag }) {
  const version = parseReleaseTag(tag)
  if (packageVersion !== version) {
    throw new Error(`tag ${tag} 与 package.json version ${packageVersion} 不一致`)
  }
  return extractChangelogNotes(changelog, version)
}

function isDirectRun() {
  const entry = process.argv[1]
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href
}

if (isDirectRun()) {
  const tag = process.argv[2]
  if (!tag) {
    console.error('用法：node scripts/github-release-notes.mjs vX.Y.Z')
    process.exit(1)
  }

  try {
    const root = process.cwd()
    const packageVersion = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version
    const changelog = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
    process.stdout.write(`${prepareReleaseNotes({ changelog, packageVersion, tag })}\n`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
