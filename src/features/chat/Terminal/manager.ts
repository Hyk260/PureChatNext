import '@xterm/xterm/css/xterm.css'

import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { create } from 'zustand'

import { getDesktopApi } from '@/types/desktop'
import type { DesktopTerminalApi, TerminalSession } from '@/types/desktopTerminal'

import { useTerminalPanelStore } from './store'

export interface TerminalEntry {
  info: TerminalSession
  terminal: Terminal
  fit: FitAddon
  container: HTMLDivElement
  opened: boolean
  exitCode?: number
  input: Promise<void>
}

interface SessionView {
  entry?: TerminalEntry
  error?: string
  loading?: boolean
  exited?: boolean
}

export const terminalProjectKey = (projectId: string | null) => projectId ?? 'desktop'
export const useTerminalSessions = create<{ sessions: Record<string, SessionView> }>(() => ({ sessions: {} }))

class TerminalManager {
  private readonly entries = new Map<string, TerminalEntry>()
  private readonly pending = new Map<string, Promise<void>>()
  private readonly earlyExits = new Map<string, number>()
  private readonly earlyOutput = new Map<string, string>()
  private cleanups: Array<() => void> = []
  private revision = 0

  private update(key: string, view: SessionView) {
    useTerminalSessions.setState((s) => ({ sessions: { ...s.sessions, [key]: view } }))
  }

  private bind(): DesktopTerminalApi {
    const api = getDesktopApi()
    if (!api?.terminal) throw new Error('当前环境不支持本机终端')
    if (this.cleanups.length === 0) {
      this.cleanups = [
        api.terminal.onData(({ sessionId, data }) => {
          const entry = this.entries.get(sessionId)
          if (entry) entry.terminal.write(data)
          else if (this.pending.size > 0)
            this.earlyOutput.set(sessionId, (this.earlyOutput.get(sessionId) ?? '') + data)
        }),
        api.terminal.onExit(({ sessionId, exitCode }) => {
          const entry = this.entries.get(sessionId)
          if (!entry) {
            if (this.pending.size > 0) this.earlyExits.set(sessionId, exitCode)
            return
          }
          this.exited(entry, exitCode)
        }),
        api.auth.onStatusChange((status) => {
          if (status.status !== 'signedIn') this.reset()
        }),
      ]
    }
    return api.terminal
  }

  private exited(entry: TerminalEntry, code: number) {
    entry.exitCode = code
    entry.terminal.options.disableStdin = true
    entry.terminal.write(`\r\n[终端已退出，退出码 ${code}]\r\n`)
    this.update(terminalProjectKey(entry.info.projectId), { entry, exited: true })
  }

  ensure(projectId: string | null): Promise<void> {
    const key = terminalProjectKey(projectId)
    const current = useTerminalSessions.getState().sessions[key]
    if (current?.entry || current?.error) return Promise.resolve()
    const pending = this.pending.get(key)
    if (pending) return pending
    const revision = this.revision
    this.update(key, { loading: true })
    const request = this.create(projectId, revision).finally(() => {
      if (this.pending.get(key) === request) this.pending.delete(key)
    })
    this.pending.set(key, request)
    return request
  }

  private async create(projectId: string | null, revision: number) {
    const key = terminalProjectKey(projectId)
    try {
      const api = this.bind()
      const info = await api.open({ projectId, cols: 80, rows: 24 })
      if (revision !== this.revision) return
      const container = document.createElement('div')
      container.className = 'size-full overflow-hidden'
      const terminal = new Terminal({
        fontSize: 12,
        fontFamily: 'Menlo, Monaco, monospace',
        cursorBlink: true,
        scrollback: 10_000,
        macOptionIsMeta: true,
      })
      const fit = new FitAddon()
      terminal.loadAddon(fit)
      const entry: TerminalEntry = { info, terminal, fit, container, opened: false, input: Promise.resolve() }
      this.entries.set(info.id, entry)
      const initialOutput = this.earlyOutput.get(info.id)
      if (initialOutput) {
        terminal.write(initialOutput)
        this.earlyOutput.delete(info.id)
      }
      terminal.onData((data) => {
        entry.input = entry.input
          .then(async () => {
            // 限制单个 IPC 消息大小，同时避免切断 UTF-16 代理对。
            for (let start = 0; start < data.length;) {
              let end = Math.min(start + 16_384, data.length)
              const last = data.charCodeAt(end - 1)
              if (end < data.length && last >= 0xd800 && last <= 0xdbff) end -= 1
              await api.write({ sessionId: info.id, data: data.slice(start, end) })
              start = end
            }
          })
          .catch((error: unknown) => this.report(entry, error))
      })
      this.update(key, { entry })
      const exitCode = this.earlyExits.get(info.id)
      if (exitCode !== undefined) {
        this.earlyExits.delete(info.id)
        this.exited(entry, exitCode)
      }
    } catch (error) {
      if (revision === this.revision)
        this.update(key, { error: error instanceof Error ? error.message : '创建终端失败' })
    }
  }

  report(entry: TerminalEntry, error: unknown) {
    if (entry.exitCode !== undefined) return
    const message = error instanceof Error ? error.message : '终端通信失败'
    this.update(terminalProjectKey(entry.info.projectId), { entry, error: message })
  }

  attach(id: string, host: HTMLElement) {
    const entry = this.entries.get(id)
    if (!entry) return
    host.append(entry.container)
    if (!entry.opened) {
      entry.terminal.open(entry.container)
      entry.opened = true
    }
    this.applyTheme(id)
    this.fit(entry)
    entry.terminal.focus()
  }

  detach(id: string) {
    this.entries.get(id)?.container.remove()
  }

  applyTheme(id: string) {
    const entry = this.entries.get(id)
    if (!entry) return
    const style = getComputedStyle(document.documentElement)
    const background = style.getPropertyValue('--lobe-color-bg-container').trim()
    const foreground = style.getPropertyValue('--lobe-color-text').trim()
    entry.terminal.options.theme = {
      background: background || '#ffffff',
      foreground: foreground || '#171717',
      cursor: foreground || '#171717',
      selectionBackground: '#80808060',
    }
  }

  fitSession(id: string) {
    const entry = this.entries.get(id)
    if (entry) this.fit(entry)
  }

  fit(entry: TerminalEntry) {
    if (!entry.opened || !entry.container.isConnected || entry.container.clientHeight === 0) return
    entry.fit.fit()
    if (entry.exitCode !== undefined) return
    this.bind()
      .resize({ sessionId: entry.info.id, cols: entry.terminal.cols, rows: entry.terminal.rows })
      .catch((error: unknown) => this.report(entry, error))
  }

  async restart(projectId: string | null) {
    const key = terminalProjectKey(projectId)
    const entry = useTerminalSessions.getState().sessions[key]?.entry
    if (entry) {
      if (entry.exitCode === undefined) await this.bind().kill({ sessionId: entry.info.id })
      entry.terminal.dispose()
      this.entries.delete(entry.info.id)
    }
    this.update(key, {})
    await this.ensure(projectId)
  }

  async kill(entry: TerminalEntry) {
    await this.bind().kill({ sessionId: entry.info.id })
  }

  reset() {
    this.revision += 1
    for (const cleanup of this.cleanups) cleanup()
    this.cleanups = []
    for (const entry of this.entries.values()) entry.terminal.dispose()
    this.entries.clear()
    this.pending.clear()
    this.earlyExits.clear()
    this.earlyOutput.clear()
    useTerminalSessions.setState({ sessions: {} })
    useTerminalPanelStore.getState().hide()
  }
}

export const terminalManager = new TerminalManager()
