import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import type { DesktopBuiltinTool, DesktopRuntimeTool, DesktopSystemTools } from '../../../../../src/types/desktop'

const execFileAsync = promisify(execFile)

const EXEC_TIMEOUT_MS = 5_000
const MAX_OUTPUT_CHARS = 2_000

type ExecFileFn = (
  file: string,
  args: readonly string[],
  options: { encoding: 'utf8'; timeout: number; windowsHide: boolean }
) => Promise<{ stdout: string; stderr: string }>

interface RuntimeToolSpec {
  description: string
  id: string
  /** Candidate binary names to resolve via which/where (first hit wins). */
  names: readonly string[]
  versionArgs: readonly string[]
}

const RUNTIME_TOOL_SPECS: readonly RuntimeToolSpec[] = [
  {
    description: 'Node.js - 执行 JavaScript/TypeScript 的运行时',
    id: 'node',
    names: ['node'],
    versionArgs: ['-v'],
  },
  {
    description: 'Python - 编程语言运行时',
    id: 'python',
    names: ['python3', 'python'],
    versionArgs: ['--version'],
  },
  {
    description: 'npm - Node.js 包管理器，用于安装依赖',
    id: 'npm',
    names: ['npm'],
    versionArgs: ['-v'],
  },
  {
    description: 'Bun - 快速的 JavaScript 运行时和包管理器',
    id: 'bun',
    names: ['bun'],
    versionArgs: ['-v'],
  },
  {
    description: 'bunx - Bun 包执行器，用于运行 npm 包',
    id: 'bunx',
    names: ['bunx'],
    versionArgs: ['-v'],
  },
  {
    description: 'pnpm - 快速、节省磁盘空间的包管理器',
    id: 'pnpm',
    names: ['pnpm'],
    versionArgs: ['-v'],
  },
  {
    description: 'uv - 极快的 Python 包管理器',
    id: 'uv',
    names: ['uv'],
    versionArgs: ['--version'],
  },
]

const unavailable = (spec: RuntimeToolSpec): DesktopRuntimeTool => ({
  available: false,
  description: spec.description,
  id: spec.id,
  name: spec.id,
  path: null,
  version: null,
})

const truncate = (value: string) => value.slice(0, MAX_OUTPUT_CHARS)

const normalizeVersion = (raw: string): string | null => {
  const text = truncate(raw).trim()
  if (!text) return null
  const firstLine = text.split(/\r?\n/, 1)[0]?.trim() ?? ''
  return firstLine || null
}

const firstPathLine = (raw: string): string | null => {
  for (const line of truncate(raw).split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed) return trimmed
  }
  return null
}

export class SystemToolsService {
  constructor(private readonly execFileFn: ExecFileFn = execFileAsync) {}

  async getSystemTools(): Promise<DesktopSystemTools> {
    const [builtin, runtime] = await Promise.all([Promise.resolve(this.getBuiltinTools()), this.getRuntimeTools()])
    return { builtin, runtime }
  }

  getBuiltinTools(): DesktopBuiltinTool[] {
    const versions = process.versions
    return [
      {
        description: 'Electron 框架版本',
        id: 'electron',
        name: 'Electron',
        version: versions.electron ?? 'unknown',
      },
      {
        description: 'Chromium 浏览器引擎版本',
        id: 'chromium',
        name: 'Chromium',
        version: versions.chrome ?? 'unknown',
      },
      {
        description: '内嵌 Node.js 版本',
        id: 'node',
        name: 'Node.js',
        version: versions.node ?? 'unknown',
      },
    ]
  }

  async getRuntimeTools(): Promise<DesktopRuntimeTool[]> {
    return Promise.all(RUNTIME_TOOL_SPECS.map((spec) => this.detectRuntimeTool(spec)))
  }

  private async detectRuntimeTool(spec: RuntimeToolSpec): Promise<DesktopRuntimeTool> {
    for (const name of spec.names) {
      const resolved = await this.resolveBinaryPath(name)
      if (!resolved) continue
      const version = await this.readVersion(resolved, spec.versionArgs)
      return {
        available: true,
        description: spec.description,
        id: spec.id,
        name: spec.id,
        path: resolved,
        version,
      }
    }
    return unavailable(spec)
  }

  private async resolveBinaryPath(name: string): Promise<string | null> {
    const isWindows = process.platform === 'win32'
    const locator = isWindows ? 'where' : 'which'
    try {
      const { stdout } = await this.execFileFn(locator, [name], {
        encoding: 'utf8',
        timeout: EXEC_TIMEOUT_MS,
        windowsHide: true,
      })
      return firstPathLine(stdout)
    } catch {
      return null
    }
  }

  private async readVersion(binaryPath: string, versionArgs: readonly string[]): Promise<string | null> {
    try {
      const { stdout, stderr } = await this.execFileFn(binaryPath, [...versionArgs], {
        encoding: 'utf8',
        timeout: EXEC_TIMEOUT_MS,
        windowsHide: true,
      })
      return normalizeVersion(stdout) ?? normalizeVersion(stderr)
    } catch (error) {
      if (error && typeof error === 'object') {
        const stdout = 'stdout' in error && typeof error.stdout === 'string' ? error.stdout : ''
        const stderr = 'stderr' in error && typeof error.stderr === 'string' ? error.stderr : ''
        return normalizeVersion(stdout) ?? normalizeVersion(stderr)
      }
      return null
    }
  }
}
