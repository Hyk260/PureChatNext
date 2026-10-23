import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DesktopApi } from '@/types/desktop'
import type { TerminalData, TerminalExit, TerminalSession } from '@/types/desktopTerminal'

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    options = {}
    write = vi.fn()
    dispose = vi.fn()
    loadAddon = vi.fn()
    onData = vi.fn()
  },
}))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class {} }))

import { terminalManager, useTerminalSessions } from './manager'
import { useTerminalPanelStore } from './store'

const session: TerminalSession = { id: 'shell-a', projectId: 'a', cwd: '/tmp/a', shell: '/bin/zsh' }

function setup(open = vi.fn(async () => session)) {
  let dataListener: (event: TerminalData) => void = () => {}
  let exitListener: (event: TerminalExit) => void = () => {}
  const offData = vi.fn()
  const offExit = vi.fn()
  const api = {
    terminal: {
      open,
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      onData: (listener: typeof dataListener) => {
        dataListener = listener
        return offData
      },
      onExit: (listener: typeof exitListener) => {
        exitListener = listener
        return offExit
      },
    },
    auth: { onStatusChange: () => vi.fn() },
  }
  window.pureChatDesktop = api as unknown as DesktopApi
  return {
    api,
    offData,
    offExit,
    data: (event: TerminalData) => dataListener(event),
    exit: (event: TerminalExit) => exitListener(event),
  }
}

afterEach(() => {
  terminalManager.reset()
  window.pureChatDesktop = undefined
})

describe('terminal session renderer lifecycle', () => {
  it('deduplicates opening and keeps the same terminal across panel collapse', async () => {
    const { api } = setup()
    await Promise.all([terminalManager.ensure('a'), terminalManager.ensure('a')])
    const entry = useTerminalSessions.getState().sessions.a.entry!
    useTerminalPanelStore.getState().hide()
    await terminalManager.ensure('a')
    expect(useTerminalSessions.getState().sessions.a.entry).toBe(entry)
    expect(api.terminal.open).toHaveBeenCalledOnce()
    expect(entry.terminal.dispose).not.toHaveBeenCalled()
  })

  it('retains output and exit events arriving before open resolves', async () => {
    let resolve!: (session: TerminalSession) => void
    const promise = new Promise<TerminalSession>((done) => {
      resolve = done
    })
    const fake = setup(vi.fn(() => promise))
    const opening = terminalManager.ensure('a')
    fake.data({ sessionId: session.id, data: 'startup error' })
    fake.exit({ sessionId: session.id, exitCode: 1 })
    resolve(session)
    await opening
    const view = useTerminalSessions.getState().sessions.a
    expect(view.exited).toBe(true)
    expect(view.entry?.terminal.write).toHaveBeenCalledWith('startup error')
  })

  it('discards pending sessions and unsubscribes on reset', async () => {
    let resolve!: (session: TerminalSession) => void
    const promise = new Promise<TerminalSession>((done) => {
      resolve = done
    })
    const fake = setup(vi.fn(() => promise))
    const opening = terminalManager.ensure('a')
    terminalManager.reset()
    resolve(session)
    await opening
    expect(useTerminalSessions.getState().sessions).toEqual({})
    expect(fake.offData).toHaveBeenCalledOnce()
    expect(fake.offExit).toHaveBeenCalledOnce()
  })
})
