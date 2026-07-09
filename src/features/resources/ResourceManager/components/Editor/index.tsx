'use client'

import { ActionIcon, Flexbox, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { X } from 'lucide-react'
import { memo } from 'react'
import { useQueryState } from 'nuqs'
import { useShallow } from 'zustand/react/shallow'

import FileIcon from '@/components/FileIcon'
import { useResourceManagerStore } from '@/features/resources/store'
import { useResourceStore } from '@/features/resources/store/resourceStore'

const styles = createStaticStyles(({ css }) => ({
  overlay: css`
    position: absolute;
    z-index: 2;
    inset: 0;
    background: ${cssVar.colorBgContainer};
  `,
  header: css`
    padding: 12px 16px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  preview: css`
    flex: 1;
    overflow: auto;
    padding: 24px;
  `,
}))

const FileEditor = memo(() => {
  const [, setFileParam] = useQueryState('file')
  const { currentViewItemId, setCurrentViewItemId, setMode } = useResourceManagerStore(
    useShallow((s) => ({
      currentViewItemId: s.currentViewItemId,
      setCurrentViewItemId: s.setCurrentViewItemId,
      setMode: s.setMode,
    })),
  )
  const item = useResourceStore((s) => s.resourceList.find((f) => f.id === currentViewItemId))

  const handleClose = () => {
    void setFileParam(null)
    setCurrentViewItemId(undefined)
    setMode('explorer')
  }

  if (!item) return null

  const isImage = item.fileType.startsWith('image/')
  const isPdf = item.fileType.includes('pdf')

  return (
    <Flexbox className={styles.overlay} height='100%'>
      <Flexbox align='center' className={styles.header} horizontal justify='space-between'>
        <Flexbox align='center' gap={8} horizontal>
          <FileIcon fileType={item.fileType} />
          <Text strong>{item.name}</Text>
        </Flexbox>
        <ActionIcon icon={X} onClick={handleClose} title='关闭' />
      </Flexbox>
      <Flexbox align='center' className={styles.preview} justify='center'>
        {isImage && item.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={item.name} src={item.url} style={{ maxHeight: '100%', maxWidth: '100%' }} />
        ) : isPdf && item.url ? (
          <iframe src={item.url} style={{ border: 'none', height: '100%', width: '100%' }} title={item.name} />
        ) : (
          <Text type='secondary'>暂不支持预览此文件类型</Text>
        )}
      </Flexbox>
    </Flexbox>
  )
})

FileEditor.displayName = 'FileEditor'

export default FileEditor
