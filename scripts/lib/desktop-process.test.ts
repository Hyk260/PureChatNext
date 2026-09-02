import { describe, expect, it } from 'vitest'

import {
  collectAncestorPids,
  collectKillTargets,
  collectStaleDesktopProcesses,
  isElectronAppCommand,
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
  57500 57491  57491 S    bun scripts/dev-desktop.mts
not-a-process
`)

    expect(rows).toEqual([
      row(57491, 1200, 57491, '/bin/zsh', 'Ss'),
      row(57500, 57491, 57491, 'bun scripts/dev-desktop.mts'),
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
    expect(isStaleDesktopCommand('bun scripts/dev-desktop.mts', ROOT)).toBe(false)
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
})

describe('collectStaleDesktopProcesses', () => {
  it('collects leftover trees and skips the current script ancestors', () => {
    const bun = row(57500, 57491, 57491, 'bun scripts/dev-desktop.mts')
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
