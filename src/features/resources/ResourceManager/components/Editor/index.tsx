'use client'

import { Flex, Typography } from 'antd'
import { ActionIcon } from '@pure/ui'
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
    }))
  )
  const item = useResourceStore((s) => s.resourceList.find((f) => f.id === currentViewItemId))

  const handleClose = () => {
    setFileParam(null)
    setCurrentViewItemId(undefined)
    setMode('explorer')
  }

  if (!item) return null

  const isImage = item.fileType.startsWith('image/')
  const isPdf = item.fileType.includes('pdf')

  return (
    <Flex vertical className={styles.overlay} style={{ height: '100%' }}>
      <Flex align='center' className={styles.header} justify='space-between'>
        <Flex align='center' gap={8}>
          <FileIcon fileType={item.fileType} />
          <Typography.Text strong>{item.name}</Typography.Text>
        </Flex>
        <ActionIcon icon={X} onClick={handleClose} title='关闭' />
      </Flex>
      <Flex vertical align='center' className={styles.preview} justify='center'>
        {isImage && item.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={item.name} src={item.url} style={{ maxHeight: '100%', maxWidth: '100%' }} />
        ) : isPdf && item.url ? (
          <iframe src={item.url} style={{ border: 'none', height: '100%', width: '100%' }} title={item.name} />
        ) : (
          <Typography.Text type='secondary'>暂不支持预览此文件类型</Typography.Text>
        )}
      </Flex>
    </Flex>
  )
})

FileEditor.displayName = 'FileEditor'

export default FileEditor
