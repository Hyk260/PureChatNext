import { describe, expect, it } from 'vitest'

import {
  collectAncestorPids,
  collectElectronAppPids,
  collectKillTargets,
  collectStaleDesktopProcesses,
  collectWindowsStaleRoots,
  isElectronAppCommand,
  isElectronMainCommand,
  isStaleDesktopCommand,
  parsePsTable,
} from './desktop-process'

const ROOT = '/Volumes/MacOs/github/PureChatNext'

const row = (
  pid: number,
  ppid: number,
  pgid: number,
  command: string,
  state = 'S'
) => ({ command, pgid, pid, ppid, state })

describe('parsePsTable', () => {
  it('parses padded ps rows and ignores invalid lines', () => {
    const rows = parsePsTable(`
  57491  1200  57491 Ss   /bin/zsh
  57500 57491  57491 S    bun scripts/electron/dev-desktop.mts
not-a-process
`)

    expect(rows).toEqual([
      row(57491, 1200, 57491, '/bin/zsh', 'Ss'),
      row(57500, 57491, 57491, 'bun scripts/electron/dev-desktop.mts'),
    ])
  })
})

describe('isStaleDesktopCommand', () => {
  it('matches electron-vite, Electron helpers, and pnpm desktop wrappers', () => {
    expect(
      isStaleDesktopCommand(
        `node ${ROOT}/node_modules/.pnpm/electron-vite@6.0.0/node_modules/electron-vite/bin/electron-vite.js dev`,
        ROOT
      )
    ).toBe(true)
    expect(
      isStaleDesktopCommand(
        `/Users/hyk/Library/Electron Helper --type=renderer --user-data-dir=/Users/hyk/Library/Application Support/purechat-desktop`,
        ROOT
      )
    ).toBe(true)
    expect(isStaleDesktopCommand('pnpm --dir apps/desktop dev', ROOT)).toBe(true)
    expect(
      isStaleDesktopCommand(
        `/path/Electron --app-path=${ROOT}/apps/desktop`,
        ROOT
      )
    ).toBe(true)
  })

  it('does not match the current desktop script or unrelated processes', () => {
    expect(isStaleDesktopCommand('bun scripts/electron/dev-desktop.mts', ROOT)).toBe(false)
    expect(isStaleDesktopCommand('pnpm run dev:desktop', ROOT)).toBe(false)
    expect(isStaleDesktopCommand('next-server', ROOT)).toBe(false)
    expect(isStaleDesktopCommand('node /other/repo/node_modules/electron-vite/bin/electron-vite.js', ROOT)).toBe(
      false
    )
  })
})

describe('isElectronAppCommand', () => {
  it('matches Electron app/helper processes but not electron-vite', () => {
    expect(
      isElectronAppCommand(`/path/Electron --app-path=${ROOT}/apps/desktop`, ROOT)
    ).toBe(true)
    expect(
      isElectronAppCommand(
        'Electron Helper --user-data-dir=/Users/hyk/Library/Application Support/purechat-desktop',
        ROOT
      )
    ).toBe(true)
    expect(isElectronAppCommand(`node ${ROOT}/node_modules/electron-vite/bin/electron-vite.js`, ROOT)).toBe(false)
  })

  it('matches the electron-vite spawned main process command (`electron .`) on all platforms', () => {
    expect(
      isElectronAppCommand(
        `${ROOT}/node_modules/.pnpm/electron@41.3.0/node_modules/electron/dist/electron.exe .`,
        ROOT
      )
    ).toBe(true)
    expect(isElectronAppCommand(`${ROOT}/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron .`, ROOT)).toBe(true)
    expect(isElectronAppCommand('/Users/hyk/node_modules/electron/dist/Electron .', ROOT)).toBe(false)
    expect(isElectronAppCommand('/other/repo/node_modules/electron/dist/electron .', ROOT)).toBe(false)
    expect(isElectronAppCommand('/tools/myelectron .', ROOT)).toBe(false)
    expect(isElectronAppCommand('/tools/not-electron .', ROOT)).toBe(false)
  })

  it('handles quoted Windows executables and app paths with spaces', () => {
    const root = 'C:\\dev\\Pure Chat Next'
    expect(isElectronAppCommand(`"${root}\\node_modules\\electron\\dist\\electron.exe" . --inspect=9229`, root)).toBe(true)
    expect(isElectronAppCommand(`"C:\\tools\\electron.exe" --type=renderer --app-path="${root}\\apps\\desktop"`, root)).toBe(true)
    expect(isElectronMainCommand('"C:\\shared tools\\electron.exe" .')).toBe(true)
    expect(isElectronMainCommand('/tools/not-electron .')).toBe(false)
  })
})

describe('collectElectronAppPids', () => {
  it('only accepts live Electron descendants of this launch on macOS', () => {
    const rows = [
      row(10, 1, 10, 'pnpm --dir apps/desktop dev'),
      row(11, 10, 10, `node ${ROOT}/node_modules/electron-vite/bin/electron-vite.js`),
      row(12, 11, 10, '/shared/Electron.app/Contents/MacOS/Electron . --inspect=9229'),
      row(13, 12, 10, `/path/Electron --app-path=${ROOT}/apps/desktop`),
      row(14, 11, 10, '/shared/Electron .', 'Z'),
      row(20, 1, 20, `${ROOT}/node_modules/electron/dist/Electron .`),
      row(21, 1, 21, '/other/repo/node_modules/electron/dist/Electron .'),
      row(22, 11, 10, '/tools/not-electron .'),
    ]

    expect(collectElectronAppPids(rows, 10, ROOT)).toEqual([12, 13])
  })

  it('follows the Windows cmd and node chain with quoted paths', () => {
    const root = 'C:\\dev\\Pure Chat Next'
    const rows = [
      row(10, 1, 10, 'cmd.exe /c pnpm --dir apps/desktop dev'),
      row(11, 10, 11, 'node pnpm.cjs --dir apps/desktop dev'),
      row(12, 11, 12, 'cmd.exe /c electron-vite dev'),
      row(13, 12, 13, `node "${root}\\node_modules\\electron-vite\\bin\\electron-vite.js"`),
      row(14, 13, 14, '"C:\\shared tools\\electron.exe" .'),
      row(15, 14, 15, `"C:\\shared tools\\electron.exe" --type=renderer --app-path="${root}\\apps\\desktop"`),
      row(20, 1, 20, '"C:\\shared tools\\electron.exe" .'),
    ]

    expect(collectElectronAppPids(rows, 10, root)).toEqual([14, 15])
    expect(collectElectronAppPids(rows.filter((item) => item.pid !== 12), 10, root)).toEqual([])
  })
})

describe('collectWindowsStaleRoots', () => {
  it('reaches a quoted orphan main process through its app helper and protects the current launch', () => {
    const root = 'C:\\dev\\Pure Chat Next'
    const main = row(10, 1, 10, '"C:\\shared tools\\electron.exe" . --inspect=9229')
    const helper = row(11, 10, 11, `"C:\\shared tools\\electron.exe" --app-path="${root}\\apps\\desktop"`)
    const rows = [main, helper]

    expect(collectWindowsStaleRoots(rows, { protectedPids: new Set(), rootDir: root })).toEqual([main])
    expect(collectWindowsStaleRoots(rows, { protectedPids: new Set([10, 11]), rootDir: root })).toEqual([])
  })

  it('stops at a protected ancestor and terminates parent-chain cycles', () => {
    const parent = row(10, 11, 10, 'pnpm --dir apps/desktop dev')
    const child = row(11, 10, 11, 'pnpm --dir apps/desktop dev')
    expect(collectWindowsStaleRoots([parent, child], { protectedPids: new Set([10]), rootDir: ROOT })).toEqual([child])
    expect(collectWindowsStaleRoots([parent, child], { protectedPids: new Set(), rootDir: ROOT })).toHaveLength(2)
  })
})

describe('collectStaleDesktopProcesses', () => {
  it('collects leftover trees and skips the current script ancestors', () => {
    const bun = row(57500, 57491, 57491, 'bun scripts/electron/dev-desktop.mts')
    const shell = row(57491, 1, 57491, '/bin/zsh', 'Ss')
    const leftoverPnpm = row(33520, 1, 33520, 'pnpm --dir apps/desktop dev')
    const leftoverVite = row(
      33640,
      33520,
      33520,
      `node ${ROOT}/apps/desktop/node_modules/electron-vite/bin/electron-vite.js dev`
    )
    const leftoverElectron = row(33642, 33640, 33520, `/path/Electron --app-path=${ROOT}/apps/desktop`)
    const leftoverHelper = row(33694, 33642, 33520, 'Electron Helper --type=gpu')
    const zombie = row(33999, 33642, 33520, `/path/Electron --app-path=${ROOT}/apps/desktop`, 'Z')

    const rows = [shell, bun, leftoverPnpm, leftoverVite, leftoverElectron, leftoverHelper, zombie]
    const protectedPids = collectAncestorPids(rows, bun.pid)
    const stale = collectStaleDesktopProcesses(rows, { protectedPids, rootDir: ROOT })

    expect(protectedPids).toEqual(new Set([57500, 57491]))
    expect(stale.map((item) => item.pid).sort((a, b) => a - b)).toEqual([33520, 33640, 33642, 33694])
  })

  it('includes unmatched children of a matched leftover parent', () => {
    const vite = row(10, 1, 10, `node ${ROOT}/node_modules/.pnpm/electron-vite@1/node_modules/electron-vite/bin/electron-vite.js`)
    const child = row(11, 10, 10, 'node ./dist/main/index.js')

    const stale = collectStaleDesktopProcesses([vite, child], {
      protectedPids: new Set([100]),
      rootDir: ROOT,
    })

    expect(stale.map((item) => item.pid).sort((a, b) => a - b)).toEqual([10, 11])
  })
})

describe('collectKillTargets', () => {
  it('kills leftover process groups without touching the current session', () => {
    const stale = [
      row(33640, 33520, 33520, 'electron-vite'),
      row(33642, 33640, 33520, 'Electron'),
    ]
    const protectedPids = new Set([57491, 57500])

    expect(collectKillTargets(stale, protectedPids)).toEqual({
      pgids: [33520],
      pids: [33640, 33642],
    })
  })
})
