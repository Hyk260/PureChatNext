import { randomBytes } from 'node:crypto'
import { chmod, lstat, open, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { parse } from 'dotenv'
import { exportJWK, generateKeyPair } from 'jose'

const SECRET_KEYS = ['AUTH_SECRET', 'KEY_VAULTS_SECRET', 'TOOL_APPROVAL_SECRET', 'CRON_SECRET', 'JWKS_KEY'] as const
const BASE_DEFAULTS = { APP_URL: 'http://localhost:5174', DATABASE_DRIVER: 'neon', DATABASE_URL: '' }

type SetupOptions = {
  root: string
  file?: string
  environment?: Partial<NodeJS.ProcessEnv>
}

async function readOptionalFile(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

async function generateSecret(key: string): Promise<string> {
  if (key !== 'JWKS_KEY') return randomBytes(32).toString('base64url')

  const { privateKey } = await generateKeyPair('RS256', { extractable: true })
  const jwk = await exportJWK(privateKey)
  return JSON.stringify({ keys: [{ ...jwk, alg: 'RS256', kid: randomBytes(8).toString('hex'), use: 'sig' }] })
}

/** 选择可无损往返 dotenv 的引号，避免 JSON、换行或 # 被错误解析。 */
function serializeValue(key: string, value: string): string {
  for (const quote of ["'", '`', '"']) {
    if (value.includes(quote)) continue
    const candidate = `${quote}${value}${quote}`
    if (parse(`${key}=${candidate}`)[key] === value) return candidate
  }
  throw new Error(`${key} 的内容无法安全写入 .env，请手动配置该字段`)
}

/** 仅补全缺失/空值；已有非空配置由调用方跳过，保留其原始文本。 */
function fillValue(contents: string, key: string, value: string, fromTemplate: boolean): string {
  const line = `${key}=${serializeValue(key, value)}`
  if (fromTemplate) {
    const templateAssignment = new RegExp(`^${key}=[^\\r\\n]*(?=\\r?$)`, 'm')
    if (templateAssignment.test(contents)) return contents.replace(templateAssignment, () => line)
  }
  const emptyAssignment = new RegExp(
    `^[ \\t]*(?:export[ \\t]+)?${key}[ \\t]*=[ \\t]*(?:"[ \\t]*"|'[ \\t]*'|[ \\t]*)(?:[ \\t]*#[^\\r\\n]*)?(?=\\r?$)`,
    'gm'
  )
  if (emptyAssignment.test(contents)) return contents.replace(emptyAssignment, () => line)

  const commentedAssignment = new RegExp(`^#[ \\t]*${key}=[^\\r\\n]*(?=\\r?$)`, 'm')
  if (commentedAssignment.test(contents)) return contents.replace(commentedAssignment, () => line)

  const newline = contents.includes('\r\n') ? '\r\n' : '\n'
  const separator = contents && !contents.endsWith('\n') ? newline : ''
  return `${contents}${separator}${line}${newline}`
}

/**
 * 首次部署初始化环境文件。非空值保持原样，缺失值优先复用进程和其他根环境文件，最后生成密钥。
 * 使用排他锁及同目录原子替换，避免并行初始化覆盖彼此生成的密钥；返回结果不包含密钥内容。
 */
export async function setupEnvironment({ root, file = '.env', environment = process.env }: SetupOptions) {
  const filePath = path.resolve(root, file)
  if (!/^\.env(?:\.local|\.[\w-]+\.local)?$/.test(path.basename(filePath))) {
    throw new Error('目标文件名必须是 .env、.env.local 或 .env.<环境>.local，避免将密钥写入可提交的文件')
  }
  const lockPath = `${filePath}.lock`
  let lock
  try {
    lock = await open(lockPath, 'wx', 0o600)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`环境文件正在初始化；确认其他 env:setup 已退出后，可删除 ${lockPath} 再重试`)
    }
    throw error
  }

  const temporaryPath = `${filePath}.${randomBytes(8).toString('hex')}.tmp`
  try {
    const info = await lstat(filePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined
      throw error
    })
    if (info && !info.isFile()) throw new Error('目标环境文件必须是普通文件，不能是目录或符号链接')

    const original = await readOptionalFile(filePath)
    let contents = original ?? (await readFile(path.join(root, '.env.example'), 'utf8'))
    const current = parse(original ?? '')
    const templateDefaults = parse(contents)
    const targetMode = /^\.env\.(development|production|test)(?:\.local)?$/.exec(path.basename(filePath))?.[1]
    const mode = targetMode || environment.NODE_ENV || 'development'
    const sourceNames = [`.env.${mode}.local`, ...(mode === 'test' ? [] : ['.env.local']), `.env.${mode}`, '.env']
    const inherited: Record<string, string> = {}
    const emptyOverrides: string[] = []
    let beforeTarget = true
    for (const name of sourceNames) {
      const sourcePath = path.join(root, name)
      if (sourcePath === filePath) {
        beforeTarget = false
        continue
      }
      const source = parse((await readOptionalFile(sourcePath)) ?? '')
      for (const [key, value] of Object.entries(source)) {
        if (inherited[key] !== undefined) continue
        inherited[key] = value
        if (beforeTarget && !value.trim()) emptyOverrides.push(`${name}: ${key}`)
      }
    }

    const generated: string[] = []
    const reused: string[] = []
    const defaults: Record<string, string> = BASE_DEFAULTS
    const keys = [...SECRET_KEYS, ...Object.keys(defaults)]
    for (const key of keys) {
      if (current[key]?.trim()) continue
      const fromProcess = environment[key]
      const fromFile = inherited[key]
      let value: string
      if (fromProcess?.trim()) {
        // Next.js 会展开 $VAR；进程变量已是实际值，持久化时转义 $ 以保持其原意。
        value = fromProcess.replace(/\$/g, '\\$')
        reused.push(key)
      } else if (fromFile?.trim()) {
        // 保留源文件里的转义；涉及变量引用时应由用户直接配置，避免持久化错误的密钥。
        if (/(?<!\\)\$/.test(fromFile)) throw new Error(`${key} 引用了其他环境变量，请在目标文件中明确配置该字段`)
        value = fromFile
        reused.push(key)
      } else if (key in defaults) {
        value = templateDefaults[key] || defaults[key]
      } else {
        value = await generateSecret(key)
        generated.push(key)
      }
      if (value === current[key] || (original === undefined && value === templateDefaults[key])) {
        current[key] = value
        continue
      }
      contents = fillValue(contents, key, value, original === undefined)
      current[key] = value
    }

    if (contents !== original) {
      await writeFile(temporaryPath, contents, { flag: 'wx', mode: 0o600 })
      if ((await readOptionalFile(filePath)) !== original) throw new Error('环境文件在初始化过程中被修改，请重试')
      await rename(temporaryPath, filePath)
    }
    await chmod(filePath, 0o600)
    const shadowed = emptyOverrides.filter((entry) => keys.some((key) => entry.endsWith(`: ${key}`)))
    return {
      filePath,
      created: original === undefined,
      generated,
      reused,
      missing: current.DATABASE_URL?.trim() ? [] : ['DATABASE_URL'],
      shadowed,
    }
  } finally {
    await rm(temporaryPath, { force: true })
    await lock.close()
    await rm(lockPath, { force: true })
  }
}
