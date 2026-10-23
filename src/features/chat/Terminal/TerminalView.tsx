import { useEffect, useRef } from 'react'

import { terminalManager } from './manager'

export default function TerminalView({ sessionId }: { sessionId: string }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = host.current
    if (!element) return
    terminalManager.attach(sessionId, element)
    const applyTheme = () => terminalManager.applyTheme(sessionId)
    const themeObserver = new MutationObserver(applyTheme)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style', 'class'],
    })
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new ResizeObserver(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => terminalManager.fitSession(sessionId), 100)
    })
    observer.observe(element)
    return () => {
      if (timer) clearTimeout(timer)
      observer.disconnect()
      themeObserver.disconnect()
      terminalManager.detach(sessionId)
    }
  }, [sessionId])

  return <div ref={host} className='size-full min-h-0 overflow-hidden' aria-label='本机交互终端' />
}
