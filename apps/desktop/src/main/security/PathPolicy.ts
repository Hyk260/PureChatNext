import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { DesktopLocalToolRequest } from '../../../../../src/types/desktop'
import type { DesktopConfig } from '../services/DesktopConfigService'

const blockedRoots = ['/System', '/private/etc', '/private/var/db', '/usr/bin/sudo']

const isInside = (target: string, root: string) => target === root || target.startsWith(`${root}${path.sep}`)

export const assertNotSensitive = (target: string) => {
  if (blockedRoots.some((root) => isInside(target, root))) throw new Error('访问系统敏感目录被拒绝')
}

export const resolveSafePath = async (request: DesktopLocalToolRequest, config: DesktopConfig, value: string) => {
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

  let existingParent = resolved
  while (existingParent !== path.dirname(existingParent)) {
    try {
      await fs.realpath(existingParent)
      break
    } catch {
      existingParent = path.dirname(existingParent)
    }
  }
  const canonicalParent = await fs.realpath(existingParent)
  const canonicalTarget = await fs.realpath(resolved).catch(() => path.join(canonicalParent, path.basename(resolved)))
  assertNotSensitive(canonicalTarget)
  if (request.mode !== 'full' && !canonicalScopes.some((allowed) => isInside(canonicalTarget, allowed))) {
    throw new Error('路径解析后超出当前话题工作目录')
  }
  return canonicalTarget
}

export const resolveCommandCwd = async (topicId: string, config: DesktopConfig) => {
  const configured = config.permissionScopes[topicId]?.[0] ?? process.cwd()
  const cwd = await fs.realpath(path.resolve(configured)).catch(() => {
    throw new Error('命令工作目录不存在')
  })
  const stat = await fs.stat(cwd)
  if (!stat.isDirectory()) throw new Error('命令工作目录必须是目录')
  assertNotSensitive(cwd)
  return cwd
}
