import { createRequire } from 'node:module'
import path from 'node:path'

import type * as Pty from '@lydell/node-pty'

export function loadTerminalRuntime(resourcesPath?: string): typeof Pty {
  const require = resourcesPath
    ? createRequire(path.join(resourcesPath, 'terminal', 'loader.cjs'))
    : createRequire(import.meta.url)
  return require('@lydell/node-pty') as typeof Pty
}
