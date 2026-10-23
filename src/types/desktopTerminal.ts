export interface TerminalOpenInput {
  projectId: string | null
  cols: number
  rows: number
}

export interface TerminalSession {
  id: string
  projectId: string | null
  cwd: string
  shell: string
  warning?: string
}

export interface TerminalSizeInput {
  sessionId: string
  cols: number
  rows: number
}

export interface TerminalData {
  sessionId: string
  data: string
}

export interface TerminalExit {
  sessionId: string
  exitCode: number
}

export interface DesktopTerminalApi {
  open: (input: TerminalOpenInput) => Promise<TerminalSession>
  write: (input: TerminalData) => Promise<void>
  resize: (input: TerminalSizeInput) => Promise<void>
  kill: (input: { sessionId: string }) => Promise<void>
  onData: (listener: (event: TerminalData) => void) => () => void
  onExit: (listener: (event: TerminalExit) => void) => () => void
}
