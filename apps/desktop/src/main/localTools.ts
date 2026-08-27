import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import type { ChildProcess, SpawnOptions } from 'node:child_process'

import type { DesktopLocalToolRequest, DesktopLocalToolResult } from '../../../../src/types/desktop'

import type { DesktopConfig } from './desktopConfig'

const MAX_FILE_BYTES = 512 * 1024
const MAX_OUTPUT_BYTES = 200 * 1024
const COMMAND_TIMEOUT_MS = 30_000
const blockedRoots = ['/System', '/private/etc', '/private/var/db', '/usr/bin/sudo']
const blockedCommands = [
  /(^|\s)sudo(\s|$)/i,
  /(^|\s)rm\s+(-[rf]+\s+)*\/(\s|$)/i,
  /:\(\)\s*\{.*:\|:.*\}/,
  /(^|\s)dd\s+if=/i,
]

type RunningCommand = {
  child: ChildProcess
  output: string
}

const runningCommands = new Map<string, RunningCommand>()
const finishedCommands = new Map<string, string>()
const completedCalls = new Map<string, DesktopLocalToolResult>()

const result = (content: string, success = true, data?: unknown): DesktopLocalToolResult => ({
  content,
  ...(data === undefined ? {} : { data }),
  success,
})

const isInside = (target: string, root: string) => target === root || target.startsWith(`${root}${path.sep}`)

const assertNotSensitive = (target: string) => {
  if (blockedRoots.some((root) => isInside(target, root))) throw new Error('访问系统敏感目录被拒绝')
}

const resolvePath = async (request: DesktopLocalToolRequest, config: DesktopConfig, value: string) => {
  const scopes = config.permissionScopes[request.topicId] ?? []
  const scope = scopes[0] ?? process.cwd()
  const allowedScopes = scopes.length > 0 ? scopes : [scope]
  const canonicalScopes = await Promise.all(
    allowedScopes.map((allowed) => fs.realpath(path.resolve(allowed)).catch(() => path.resolve(allowed)))
  )
  const resolved = path.resolve(path.isAbsolute(value) ? value : path.join(scope, value))
  assertNotSensitive(resolved)

  if (request.mode !== 'full' && !allowedScopes.some((allowed) => isInside(resolved, path.resolve(allowed)))) {
    throw new Error('路径不在当前话题允许的工作目录内')
  }

  const existingParent = await (async () => {
    let candidate = resolved
    while (candidate !== path.dirname(candidate)) {
      try {
        await fs.realpath(candidate)
        return candidate
      } catch {
        candidate = path.dirname(candidate)
      }
    }
    return candidate
  })()
  const canonicalParent = await fs.realpath(existingParent)
  const canonicalTarget = await fs.realpath(resolved).catch(() => path.join(canonicalParent, path.basename(resolved)))
  assertNotSensitive(canonicalTarget)
  if (request.mode !== 'full' && !canonicalScopes.some((allowed) => isInside(canonicalTarget, allowed))) {
    throw new Error('路径解析后超出当前话题工作目录')
  }
  return resolved
}

const assertCommandAllowed = (command: string, mode: DesktopLocalToolRequest['mode']) => {
  if (blockedCommands.some((pattern) => pattern.test(command))) throw new Error('命令命中系统安全黑名单')
  if (mode !== 'full' && /(^|\s)(curl|wget|nc|ssh|scp)(\s|$)/i.test(command)) {
    throw new Error('联网或远程命令需要完全访问权限')
  }
}

const hashKey = (request: DesktopLocalToolRequest) => `${request.topicId}:${request.toolCallId}`

export const requestFullAccess = async (
  topicId: string,
  grantedTopics: Set<string>,
  showConfirm: () => Promise<boolean>
) => {
  if (grantedTopics.has(topicId)) return { granted: true }
  if (topicId !== 'draft' && grantedTopics.has('draft')) {
    grantedTopics.add(topicId)
    return { granted: true }
  }
  const granted = await showConfirm()
  if (granted) grantedTopics.add(topicId)
  return { granted }
}

export const executeLocalTool = async (
  request: DesktopLocalToolRequest,
  config: DesktopConfig,
  grantedTopics: Set<string>
): Promise<DesktopLocalToolResult> => {
  const key = hashKey(request)
  const cached = completedCalls.get(key)
  if (cached) return cached
  if (request.mode === 'full' && !grantedTopics.has(request.topicId)) return result('完全访问权限尚未确认', false)

  try {
    const args = request.args
    let output: DesktopLocalToolResult
    switch (request.toolName) {
      case 'readFile': {
        const filePath = await resolvePath(request, config, String(args.path ?? ''))
        const content = await fs.readFile(filePath, 'utf8')
        output = result(content.slice(0, MAX_FILE_BYTES), true, { path: filePath })
        break
      }
      case 'getSystemInfo': {
        output = result(
          JSON.stringify({
            arch: process.arch,
            kernel: os.release(),
            platform: process.platform,
            system: os.type(),
          }),
          true
        )
        break
      }
      case 'listFiles': {
        const directory = await resolvePath(request, config, String(args.path ?? '.'))
        const entries = await fs.readdir(directory, { withFileTypes: true })
        output = result(
          JSON.stringify(
            entries.slice(0, 500).map((entry) => ({
              name: entry.name,
              isDirectory: entry.isDirectory(),
            }))
          ),
          true,
          { path: directory }
        )
        break
      }
      case 'searchFiles': {
        const root = await resolvePath(request, config, String(args.path ?? '.'))
        const query = String(args.query ?? '').toLowerCase()
        const matches: string[] = []
        const walk = async (directory: string): Promise<void> => {
          if (matches.length >= 200) return
          for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
            const fullPath = path.join(directory, entry.name)
            if (entry.name.toLowerCase().includes(query)) matches.push(fullPath)
            if (entry.isDirectory()) await walk(fullPath)
            if (matches.length >= 200) return
          }
        }
        await walk(root)
        output = result(JSON.stringify(matches), true, { path: root })
        break
      }
      case 'writeFile': {
        if (request.mode !== 'full' && !request.approved) throw new Error('文件写入需要在审批卡片中确认')
        const filePath = await resolvePath(request, config, String(args.path ?? ''))
        await fs.writeFile(filePath, String(args.content ?? ''), 'utf8')
        output = result(`已写入 ${filePath}`, true, { path: filePath })
        break
      }
      case 'editFile': {
        if (request.mode !== 'full' && !request.approved) throw new Error('文件编辑需要在审批卡片中确认')
        const filePath = await resolvePath(request, config, String(args.path ?? ''))
        const content = await fs.readFile(filePath, 'utf8')
        const search = String(args.search ?? '')
        if (!search) throw new Error('编辑内容不能为空')
        await fs.writeFile(filePath, content.replace(search, String(args.replace ?? '')), 'utf8')
        output = result(`已编辑 ${filePath}`, true, { path: filePath })
        break
      }
      case 'moveFile': {
        if (request.mode !== 'full' && !request.approved) throw new Error('文件移动需要在审批卡片中确认')
        const source = await resolvePath(request, config, String(args.source ?? ''))
        const destination = await resolvePath(request, config, String(args.destination ?? ''))
        await fs.rename(source, destination)
        output = result(`已移动 ${source} -> ${destination}`, true, { source, destination })
        break
      }
      case 'runCommand': {
        if (request.mode !== 'full' && !request.approved) throw new Error('终端命令需要审批')
        const command = String(args.command ?? '')
        assertCommandAllowed(command, request.mode)
        const cwd = await resolvePath(request, config, config.permissionScopes[request.topicId]?.[0] ?? '.')
        const cwdStat = await fs.stat(cwd)
        if (!cwdStat.isDirectory()) throw new Error('命令工作目录无效')
        const shellId = randomUUID()
        const child = spawn(command, {
          cwd,
          env: {
            HOME: process.env.HOME ?? '',
            LANG: process.env.LANG ?? 'C',
            NODE_ENV: 'production',
            PATH: process.env.PATH ?? '',
          } as NodeJS.ProcessEnv,
          shell: true,
        } as SpawnOptions) as ChildProcess
        const state: RunningCommand = { child, output: '' }
        runningCommands.set(shellId, state)
        const append = (chunk: Buffer) => {
          state.output = `${state.output}${chunk.toString('utf8')}`.slice(-MAX_OUTPUT_BYTES)
        }
        child.stdout?.on('data', append)
        child.stderr?.on('data', append)
        const timeout = setTimeout(() => child.kill('SIGTERM'), COMMAND_TIMEOUT_MS)
        child.once('close', () => {
          clearTimeout(timeout)
          runningCommands.delete(shellId)
          finishedCommands.set(shellId, state.output)
          if (finishedCommands.size > 100) {
            const oldest = finishedCommands.keys().next().value
            if (oldest) finishedCommands.delete(oldest)
          }
        })
        output = result(JSON.stringify({ shellId, started: true }), true, { shellId })
        break
      }
      case 'getCommandOutput': {
        const shellId = String(args.shellId ?? '')
        const state = runningCommands.get(shellId)
        if (!state) {
          const finished = finishedCommands.get(shellId)
          output = finished === undefined ? result('命令已完成或不存在', false) : result(finished, true, { shellId })
        } else output = result(state.output, true, { shellId })
        break
      }
      case 'killCommand': {
        const shellId = String(args.shellId ?? '')
        const state = runningCommands.get(shellId)
        if (!state) output = result('命令已完成或不存在', false)
        else {
          state.child.kill('SIGTERM')
          output = result(`已终止命令 ${shellId}`, true, { shellId })
        }
        break
      }
      default:
        output = result('未知本地工具', false)
    }
    if (output.success) completedCalls.set(key, output)
    return output
  } catch (error) {
    return result(error instanceof Error ? error.message : '本地工具执行失败', false)
  }
}
