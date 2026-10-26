export interface BrowserSessionInput {
  contextKey: string
}

export interface BrowserSessionRef {
  sessionId: string
}

export interface BrowserState extends BrowserSessionRef {
  contextKey: string
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error?: string
}

export interface BrowserLayout extends BrowserSessionRef {
  visible: boolean
  x: number
  y: number
  width: number
  height: number
}

export interface BrowserElement {
  url: string
  pageTitle: string
  tag: string
  selector: string
  text: string
  html: string
}

export interface BrowserCapture {
  dataUrl: string
  title: string
}

export interface DesktopBrowserApi {
  open: (input: BrowserSessionInput) => Promise<BrowserState>
  navigate: (input: BrowserSessionRef & { url: string }) => Promise<void>
  back: (input: BrowserSessionRef) => Promise<void>
  forward: (input: BrowserSessionRef) => Promise<void>
  reload: (input: BrowserSessionRef) => Promise<void>
  stop: (input: BrowserSessionRef) => Promise<void>
  layout: (input: BrowserLayout) => Promise<void>
  capture: (input: BrowserSessionRef) => Promise<BrowserCapture>
  openExternal: (input: BrowserSessionRef) => Promise<void>
  pick: (input: BrowserSessionRef) => Promise<BrowserElement | null>
  cancelPick: (input: BrowserSessionRef) => Promise<void>
  close: (input: BrowserSessionRef) => Promise<void>
  reset: () => Promise<void>
  onStateChange: (listener: (state: BrowserState) => void) => () => void
}
