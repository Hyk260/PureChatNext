import { ActionIcon } from '@lobehub/ui'
import { SquareTerminal } from 'lucide-react'
import { useEffect } from 'react'

import { getDesktopApi } from '@/types/desktop'

import { useTerminalPanelStore } from './store'

export default function TerminalToggle() {
  const available = useTerminalPanelStore((s) => s.available)
  const open = useTerminalPanelStore((s) => s.open)
  const toggle = useTerminalPanelStore((s) => s.toggle)

  useEffect(() => {
    const api = getDesktopApi()
    if (!api?.terminal) return
    let cancelled = false
    api
      .getAppInfo()
      .then((info) => {
        if (!cancelled) useTerminalPanelStore.getState().setAvailable(info.platform === 'darwin')
      })
      .catch(() => {
        if (!cancelled) useTerminalPanelStore.getState().setAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!available) return null
  return <ActionIcon active={open} aria-label='终端' icon={SquareTerminal} size='small' title='终端' onClick={toggle} />
}
