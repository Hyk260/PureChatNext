import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { DesktopLocalToolRequest, DesktopLocalToolResult } from '../../../../../src/types/desktop'

import { resolveSafePath } from '../security/PathPolicy'
import { requiresNativeApproval } from '../security/PermissionPolicy'
import type { CommandService } from './CommandService'
import type { DesktopConfigService } from './DesktopConfigService'
import type { PermissionService } from './PermissionService'

const MAX_FILE_BYTES = 512 * 1024

const result = (content: string, success = true, data?: unknown): DesktopLocalToolResult => ({
  content,
  ...(data === undefined ? {} : { data }),
  success,
})

export class LocalToolService {
  private readonly completedCalls = new Map<string, DesktopLocalToolResult>()

  constructor(
    private readonly config: DesktopConfigService,
    private readonly permissions: PermissionService,
    private readonly commands: CommandService
  ) {}

  async execute(request: DesktopLocalToolRequest): Promise<DesktopLocalToolResult> {
    const argsHash = createHash('sha256').update(JSON.stringify(request.args)).digest('hex')
    const key = `${request.topicId}:${request.toolCallId}:${argsHash}`
    const cached = this.completedCalls.get(key)
    if (cached) return cached

    try {
      const config = await this.config.read()
      this.permissions.assertExecutionAllowed(request.topicId, request.mode)
      const args = request.args
      let output: DesktopLocalToolResult
      switch (request.toolName) {
        case 'getSystemInfo':
          output = result(
            JSON.stringify({ arch: process.arch, kernel: os.release(), platform: process.platform, system: os.type() })
          )
          break
        case 'readFile': {
          const filePath = await resolveSafePath(request, config, String(args.path ?? ''))
          output = result((await fs.readFile(filePath, 'utf8')).slice(0, MAX_FILE_BYTES), true, { path: filePath })
          break
        }
        case 'listFiles': {
          const directory = await resolveSafePath(request, config, String(args.path ?? '.'))
          const entries = await fs.readdir(directory, { withFileTypes: true })
          output = result(
            JSON.stringify(
              entries.slice(0, 500).map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }))
            ),
            true,
            { path: directory }
          )
          break
        }
        case 'searchFiles': {
          const root = await resolveSafePath(request, config, String(args.path ?? '.'))
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
          await this.assertHighRiskApproval(request, '文件写入')
          const filePath = await resolveSafePath(request, config, String(args.path ?? ''))
          await fs.writeFile(filePath, String(args.content ?? ''), 'utf8')
          output = result(`已写入 ${filePath}`, true, { path: filePath })
          break
        }
        case 'editFile': {
          await this.assertHighRiskApproval(request, '文件编辑')
          const filePath = await resolveSafePath(request, config, String(args.path ?? ''))
          const content = await fs.readFile(filePath, 'utf8')
          const search = String(args.search ?? '')
          if (!search) throw new Error('编辑内容不能为空')
          await fs.writeFile(filePath, content.replace(search, String(args.replace ?? '')), 'utf8')
          output = result(`已编辑 ${filePath}`, true, { path: filePath })
          break
        }
        case 'moveFile': {
          await this.assertHighRiskApproval(request, '文件移动')
          const source = await resolveSafePath(request, config, String(args.source ?? ''))
          const destination = await resolveSafePath(request, config, String(args.destination ?? ''))
          await fs.rename(source, destination)
          output = result(`已移动 ${source} -> ${destination}`, true, { source, destination })
          break
        }
        case 'runCommand':
          output = await this.commands.run(
            request.topicId,
            request.mode,
            String(args.command ?? ''),
            request.toolCallId,
            config
          )
          break
        case 'getCommandOutput':
          output = this.commands.getOutput(String(args.shellId ?? ''))
          break
        case 'killCommand':
          output = this.commands.kill(String(args.shellId ?? ''))
          break
        default:
          output = result('未知本地工具', false)
      }
      if (output.success) this.completedCalls.set(key, output)
      return output
    } catch (error) {
      return result(error instanceof Error ? error.message : '本地工具执行失败', false)
    }
  }

  private async assertHighRiskApproval(request: DesktopLocalToolRequest, description: string) {
    if (!requiresNativeApproval(request.mode, 'write')) return
    if (!(await this.permissions.requestToolApproval(request.topicId, request.toolCallId, description))) {
      throw new Error(`${description}需要审批`)
    }
  }

  dispose() {
    this.completedCalls.clear()
    this.commands.dispose()
  }
}
