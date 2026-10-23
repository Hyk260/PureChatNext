import { DraggablePanel } from '@lobehub/ui'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { DesktopProject } from '@/types/desktop'

import { clampTerminalHeight, terminalHeightBounds, useTerminalPanelStore } from './store'

const Content = lazy(() => import('./Content'))

export interface TerminalPanelProps {
  projectName: string | null
  onProjectChange: (project: DesktopProject | null) => Promise<void>
}

export default function TerminalPanel(props: TerminalPanelProps) {
  const available = useTerminalPanelStore((s) => s.available)
  const open = useTerminalPanelStore((s) => s.open)
  const height = useTerminalPanelStore((s) => s.height)
  const setHeight = useTerminalPanelStore((s) => s.setHeight)
  const root = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(0)

  useEffect(() => {
    const container = root.current?.parentElement
    if (!container) return
    const observer = new ResizeObserver(() => setContainerHeight(container.clientHeight))
    observer.observe(container)
    setContainerHeight(container.clientHeight)
    return () => observer.disconnect()
  }, [])

  const { min, max } = terminalHeightBounds(containerHeight)
  const visible = available && open && max > 0
  return (
    <div ref={root} className='shrink-0 min-h-0' data-terminal-panel data-open={visible}>
      {available ? (
        <DraggablePanel
          classNames={{ content: 'h-full min-h-0' }}
          expand={visible}
          expandable={false}
          maxHeight={max}
          minHeight={min}
          placement='bottom'
          showHandleWhenCollapsed={false}
          size={{ height: clampTerminalHeight(height, containerHeight), width: '100%' }}
          onSizeChange={(_, size) => {
            if (typeof size.height === 'number') setHeight(size.height)
          }}
        >
          {visible ? (
            <Suspense fallback={null}>
              <Content {...props} />
            </Suspense>
          ) : null}
        </DraggablePanel>
      ) : null}
    </div>
  )
}
