#!/usr/bin/env node
/**
 * 手动桌面发行：只依赖 Node 标准库，prepare / draft job 无需 pnpm install。
 * 从仓库根目录执行：
 *   node scripts/github-desktop-release.mjs version
 *   node scripts/github-desktop-release.mjs preflight
 *   node scripts/github-desktop-release.mjs verify apps/desktop/release mac
 *   node scripts/github-desktop-release.mjs draft desktop-release-artifacts [source-dir]
 * preflight 读取 GITHUB_REPOSITORY、GITHUB_SHA、PURECHAT_DESKTOP_CLOUD_URL；draft 还需要 GH_TOKEN、gh 和 git。
 * API / 上传失败会返回非零状态；草稿保持未发布，修复后可用同 commit 重跑。
 */
import { execFileSync } from 'node:child_process'
import { lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export function desktopArtifacts(version, platform = 'all') {
  if (!VERSION_PATTERN.test(version)) throw new Error('桌面发行版本必须是 X.Y.Z')
  const artifacts = {
    windows: [`PureChat-${version}-setup.exe`, `PureChat-${version}-portable.exe`],
    mac: [`PureChat-${version}-arm64.dmg`, `PureChat-${version}-arm64.zip`],
  }
  if (platform === 'all') return [...artifacts.windows, ...artifacts.mac]
  if (!(platform === 'windows' || platform === 'mac')) throw new Error(`未知桌面平台: ${platform}`)
  return artifacts[platform]
}

/** 安装文件与更新元数据必须一起发布；portable 不生成更新 blockmap。 */
export function desktopReleaseAssets(version, platform = 'all') {
  const [installer, portable, dmg, zip] = desktopArtifacts(version)
  const assets = {
    windows: [installer, portable, 'latest.yml', `${installer}.blockmap`],
    mac: [dmg, zip, 'latest-mac.yml', `${dmg}.blockmap`, `${zip}.blockmap`],
  }
  if (platform === 'all') return [...assets.windows, ...assets.mac]
  if (!(platform === 'windows' || platform === 'mac')) throw new Error(`未知桌面平台: ${platform}`)
  return assets[platform]
}

/** 在下载依赖和启动双平台构建前验证发行输入，不访问或改写远端。 */
export function validateDesktopBuildConfig({ version, repository, sha, notes, cloudUrl }) {
  desktopReleaseNotes({ version, repository, notes })
  validateDesktopDraft({ release: undefined, tagCommit: null, sha })
  let url
  try {
    url = new URL(cloudUrl)
  } catch {
    throw new Error('PURECHAT_DESKTOP_CLOUD_URL 必须是有效的 HTTP(S) 服务地址')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('PURECHAT_DESKTOP_CLOUD_URL 必须是无凭据的 HTTP(S) 服务地址')
  }
}

export function verifyDesktopArtifacts(directory, version, platform = 'all') {
  return desktopReleaseAssets(version, platform).map((filename) => {
    const file = path.resolve(directory, filename)
    let stat
    try {
      stat = lstatSync(file)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      throw new Error(`缺少桌面产物: ${filename}`)
    }
    if (!stat.isFile() || stat.size === 0) throw new Error(`桌面产物必须是非空普通文件: ${filename}`)
    return file
  })
}

export function desktopReleaseNotes({ version, repository, notes }) {
  const [installer, portable, dmg, zip] = desktopArtifacts(version)
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('无效的 GitHub 仓库名')
  if (!notes.trim()) throw new Error('桌面发行说明不能为空')
  const baseUrl = `https://github.com/${repository}/releases/download/v${version}`
  return [
    `## Downloads (v${version})`,
    '',
    '| 平台 | Architecture | 下载 |',
    '| --- | --- | --- |',
    `| Windows | x64 | [Installer](${baseUrl}/${installer}) · [Portable](${baseUrl}/${portable}) |`,
    `| macOS | Apple silicon (arm64) | [DMG](${baseUrl}/${dmg}) · [ZIP](${baseUrl}/${zip}) |`,
    '',
    '> 本版未接入正式代码签名及 macOS 公证，系统可能显示安全提示；macOS 不支持自动安装更新。',
    '',
    notes.trim(),
    '',
  ].join('\n')
}

export function readDesktopReleaseMetadata(sourceDir = '.') {
  const { version } = JSON.parse(readFileSync(path.join(sourceDir, 'package.json'), 'utf8'))
  const notes = readFileSync(path.join(sourceDir, 'apps/desktop/build/release-notes.md'), 'utf8')
  return { notes, version }
}

/** 仅允许新草稿或同 commit 重跑，拒绝公开版本与来源不一致的草稿 / tag。 */
export function validateDesktopDraft({ release, tagCommit, sha }) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('发行必须绑定完整 commit SHA')
  if (tagCommit && tagCommit !== sha) throw new Error('已有 tag 指向不同 commit')
  if (release) {
    if (release.draft !== true) throw new Error('该版本已公开发布，拒绝覆盖')
    if (release.target_commitish !== sha) throw new Error('草稿来源与本次 commit 不一致')
  }
}

// 附注 tag 的 ^{} 行才是 commit SHA；不能把 tag 对象的 SHA 当成应用源码版本。
export function remoteTagCommit(output, tag) {
  const refs = new Map(
    output
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [commit, ref] = line.split(/\s+/)
        return [ref, commit]
      })
  )
  return refs.get(`refs/tags/${tag}^{}`) || refs.get(`refs/tags/${tag}`) || null
}

function runCommand(command, args) {
  // 使用参数数组，不经 shell 拼接；发行说明通过临时文件传给 gh，保留 Markdown 的真实换行。
  return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
}

export function writeDesktopDraft({ directory, version, repository, sha, notes }, run = runCommand) {
  const files = verifyDesktopArtifacts(directory, version)
  const body = desktopReleaseNotes({ version, repository, notes })
  const tag = `v${version}`
  // 必须读取所有分页，包括有写权限时可见的草稿；API 失败不能按“版本不存在”处理。
  const pages = JSON.parse(run('gh', ['api', `repos/${repository}/releases?per_page=100`, '--paginate', '--slurp']))
  const matches = pages.flat().filter((release) => release.tag_name === tag)
  if (matches.length > 1) throw new Error('同版本存在多个 Release，拒绝写入')
  const release = matches[0]
  const tagRefs = run('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`])
  validateDesktopDraft({ release, tagCommit: remoteTagCommit(tagRefs, tag), sha })

  const temporaryDir = mkdtempSync(path.join(tmpdir(), 'purechat-desktop-release-'))
  try {
    const notesFile = path.join(temporaryDir, 'release-notes.md')
    writeFileSync(notesFile, body)
    if (release) {
      run('gh', ['release', 'edit', tag, '--repo', repository, '--notes-file', notesFile])
    } else {
      run('gh', [
        'release',
        'create',
        tag,
        '--repo',
        repository,
        '--target',
        sha,
        '--draft',
        '--title',
        tag,
        '--notes-file',
        notesFile,
      ])
    }
    run('gh', ['release', 'upload', tag, ...files, '--repo', repository, '--clobber'])
    return tag
  } finally {
    rmSync(temporaryDir, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [command, directory, platform, sourceDir] = process.argv.slice(2)
    const metadataRoot = command === 'draft' && sourceDir ? sourceDir : '.'
    const releaseMetadata = command === 'draft' ? readDesktopReleaseMetadata(metadataRoot) : undefined
    const { version } = releaseMetadata ?? JSON.parse(readFileSync(path.join(metadataRoot, 'package.json'), 'utf8'))
    desktopArtifacts(version)
    if (command === 'version') {
      console.info(version)
    } else if (command === 'preflight') {
      validateDesktopBuildConfig({
        version,
        repository: process.env.GITHUB_REPOSITORY,
        sha: process.env.GITHUB_SHA,
        cloudUrl: process.env.PURECHAT_DESKTOP_CLOUD_URL,
        notes: releaseMetadata?.notes ?? readFileSync(path.join(metadataRoot, 'apps/desktop/build/release-notes.md'), 'utf8'),
      })
      console.info(version)
    } else if (command === 'verify' && directory) {
      const files = verifyDesktopArtifacts(directory, version, platform)
      console.info(`已验证 ${files.length} 个桌面产物`)
    } else if (command === 'draft' && directory) {
      const tag = writeDesktopDraft({
        directory,
        version,
        repository: process.env.GITHUB_REPOSITORY,
        sha: process.env.GITHUB_SHA,
        notes: releaseMetadata?.notes ?? readFileSync(path.join(metadataRoot, 'apps/desktop/build/release-notes.md'), 'utf8'),
      })
      console.info(`已更新 ${tag} 的 Release 草稿，请检查安装文件和更新元数据后手动发布`)
    } else {
      throw new Error(
        '用法: node scripts/github-desktop-release.mjs version | preflight | verify <目录> [windows|mac|all] | draft <目录> [源码目录]'
      )
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
