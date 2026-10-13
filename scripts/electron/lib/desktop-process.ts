export interface ProcessRow {
  command: string
  pgid: number
  pid: number
  ppid: number
  state: string
}

export interface StaleProcessOptions {
  protectedPids: ReadonlySet<number>
  rootDir: string
}

const PS_LINE_PATTERN = /^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/
const PNPM_DESKTOP_DIR_PATTERN = /--dir[= ](?:\S*\/)?apps\/desktop(?:\s|$)/

const normalizePath = (value: string) => value.replaceAll('\\', '/')
const normalizeCommand = (command: string) => normalizePath(command).replaceAll('"', '')

/** electron-vite 的主进程使用 `electron .`，也可能带调试参数或 Windows 路径引号。 */
export const isElectronMainCommand = (command: string): boolean =>
  /^(?:.*\/)?electron(?:\.exe)?\s+\.(?:\s|$)/i.test(normalizeCommand(command))

export const parsePsLine = (line: string): ProcessRow | null => {
  const match = line.trim().match(PS_LINE_PATTERN)
  if (!match) return null

  const command = match[5]?.trim()
  if (!command) return null

  return {
    command,
    pgid: Number(match[3]),
    pid: Number(match[1]),
    ppid: Number(match[2]),
    state: match[4],
  }
}

export const parsePsTable = (stdout: string): ProcessRow[] =>
  stdout
    .split('\n')
    .map(parsePsLine)
    .filter((row): row is ProcessRow => row !== null)

export const isStaleDesktopCommand = (command: string, rootDir: string): boolean => {
  const normalizedCommand = normalizeCommand(command)
  const normalizedRoot = normalizePath(rootDir)
  const desktopAppPath = `${normalizedRoot}/apps/desktop`

  if (normalizedCommand.includes(desktopAppPath)) return true
  if (normalizedCommand.includes('electron-vite') && normalizedCommand.includes(normalizedRoot)) return true
  if (/Electron/i.test(normalizedCommand) && normalizedCommand.includes('purechat-desktop')) return true
  if (/\bpnpm\b/.test(normalizedCommand) && PNPM_DESKTOP_DIR_PATTERN.test(normalizedCommand)) return true
  return false
}

export const isElectronAppCommand = (command: string, rootDir: string): boolean => {
  const normalizedCommand = normalizeCommand(command)
  if (!/Electron/i.test(normalizedCommand) || normalizedCommand.includes('electron-vite')) return false

  const normalizedRoot = normalizePath(rootDir)
  if (isElectronMainCommand(command) && normalizedCommand.startsWith(`${normalizedRoot}/`)) return true

  const desktopAppPath = `${normalizedRoot}/apps/desktop`
  return (
    normalizedCommand.includes(`app-path=${desktopAppPath}`) ||
    normalizedCommand.includes(`${desktopAppPath}/dist/main`) ||
    normalizedCommand.includes('purechat-desktop')
  )
}

export const collectAncestorPids = (rows: readonly ProcessRow[], pid: number): Set<number> => {
  const byPid = new Map(rows.map((row) => [row.pid, row]))
  const ancestors = new Set<number>()
  let current = byPid.get(pid)

  while (current && !ancestors.has(current.pid)) {
    ancestors.add(current.pid)
    current = byPid.get(current.ppid)
  }

  return ancestors
}

const isAliveProcess = (row: ProcessRow) => !row.state.startsWith('Z')

/** 就绪检测只接受本次 pnpm 启动树内的 Electron，兼容共享安装位置。 */
export const collectElectronAppPids = (rows: readonly ProcessRow[], parentPid: number, rootDir: string): number[] =>
  rows
    .filter(
      (row) =>
        isAliveProcess(row) &&
        row.pid !== parentPid &&
        (isElectronMainCommand(row.command) || isElectronAppCommand(row.command, rootDir)) &&
        collectAncestorPids(rows, row.pid).has(parentPid)
    )
    .map((row) => row.pid)

/** Windows 使用 taskkill /T，沿工具链父进程上溯后结束整树。 */
export const collectWindowsStaleRoots = (rows: readonly ProcessRow[], options: StaleProcessOptions): ProcessRow[] => {
  const byPid = new Map(rows.map((row) => [row.pid, row]))
  const roots = new Map<number, ProcessRow>()

  for (const row of rows) {
    if (options.protectedPids.has(row.pid) || !isStaleDesktopCommand(row.command, options.rootDir)) continue

    const visited = new Set([row.pid])
    let root = row
    let parent = byPid.get(root.ppid)
    while (
      parent &&
      !visited.has(parent.pid) &&
      !options.protectedPids.has(parent.pid) &&
      (isStaleDesktopCommand(parent.command, options.rootDir) || isElectronMainCommand(parent.command))
    ) {
      visited.add(parent.pid)
      root = parent
      parent = byPid.get(root.ppid)
    }
    roots.set(root.pid, root)
  }

  return [...roots.values()]
}

export const collectStaleDesktopProcesses = (
  rows: readonly ProcessRow[],
  options: StaleProcessOptions
): ProcessRow[] => {
  const childrenByParent = new Map<number, ProcessRow[]>()
  for (const row of rows) {
    const children = childrenByParent.get(row.ppid)
    if (children) children.push(row)
    else childrenByParent.set(row.ppid, [row])
  }

  const matched = rows.filter(
    (row) =>
      isAliveProcess(row) &&
      !options.protectedPids.has(row.pid) &&
      isStaleDesktopCommand(row.command, options.rootDir)
  )

  const collected = new Map<number, ProcessRow>()
  const queue = [...matched]
  for (const row of matched) collected.set(row.pid, row)

  while (queue.length > 0) {
    const current = queue.pop()
    if (!current) continue
    for (const child of childrenByParent.get(current.pid) ?? []) {
      if (collected.has(child.pid) || options.protectedPids.has(child.pid) || !isAliveProcess(child)) continue
      collected.set(child.pid, child)
      queue.push(child)
    }
  }

  return [...collected.values()]
}

export const collectKillTargets = (stale: readonly ProcessRow[], protectedPids: ReadonlySet<number>) => {
  const pids = stale.map((row) => row.pid)
  const pgids = [...new Set(stale.map((row) => row.pgid))].filter((pgid) => pgid > 1 && !protectedPids.has(pgid))
  return { pgids, pids }
}
