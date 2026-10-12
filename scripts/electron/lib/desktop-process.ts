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
  const normalizedCommand = normalizePath(command)
  const normalizedRoot = normalizePath(rootDir)
  const desktopAppPath = `${normalizedRoot}/apps/desktop`

  if (normalizedCommand.includes(desktopAppPath)) return true
  if (normalizedCommand.includes('electron-vite') && normalizedCommand.includes(normalizedRoot)) return true
  if (/Electron/i.test(normalizedCommand) && normalizedCommand.includes('purechat-desktop')) return true
  if (/\bpnpm\b/.test(normalizedCommand) && PNPM_DESKTOP_DIR_PATTERN.test(normalizedCommand)) return true
  return false
}

export const isElectronAppCommand = (command: string, rootDir: string): boolean => {
  const normalizedCommand = normalizePath(command)
  if (!/Electron/i.test(normalizedCommand) || normalizedCommand.includes('electron-vite')) return false

  const desktopAppPath = `${normalizePath(rootDir)}/apps/desktop`
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
