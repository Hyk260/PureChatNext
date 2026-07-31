'use client'

import { createStaticStyles, cssVar } from 'antd-style'
import { Flexbox } from '@pure/ui'
import { memo, useCallback, useRef, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'

const styles = createStaticStyles(({ css }) => ({
  overlay: css`
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${cssVar.colorPrimaryBg};
    border: 2px dashed ${cssVar.colorPrimary};
    border-radius: ${cssVar.borderRadiusLG};
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;

    &.active {
      opacity: 1;
    }
  `,
  zone: css`
    position: relative;
    width: 100%;
    height: 100%;
  `,
}))

interface DragUploadZoneProps {
  children: ReactNode
  disabled?: boolean
  onUploadFiles: (files: File[]) => void
}

const DragUploadZone = memo<DragUploadZoneProps>(({ children, disabled, onUploadFiles }) => {
  const [active, setActive] = useState(false)
  const dragCounter = useRef(0)

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      if (disabled) return
      dragCounter.current += 1
      setActive(true)
    },
    [disabled]
  )

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setActive(false)
    }
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      dragCounter.current = 0
      setActive(false)
      if (disabled) return
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) onUploadFiles(files)
    },
    [disabled, onUploadFiles]
  )

  return (
    <div
      className={styles.zone}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      <Flexbox align='center' className={[styles.overlay, active ? 'active' : ''].join(' ')} justify='center'>
        释放以上传文件
      </Flexbox>
    </div>
  )
})

DragUploadZone.displayName = 'DragUploadZone'

export default DragUploadZone
