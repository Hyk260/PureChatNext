'use client'

import { ActionIcon, Text, Flexbox } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { ArrowLeft } from 'lucide-react'
import { memo } from 'react'
import { useQueryState } from 'nuqs'
import { useShallow } from 'zustand/react/shallow'

import { useResourceManagerStore } from '@/features/resources/store'
import { useResourceStore } from '@/features/resources/store/resourceStore'

import FileContent from './FileContent'

const styles = createStaticStyles(({ css }) => ({
  overlay: css`
    position: absolute;
    z-index: 2;
    inset: 0;
    background: ${cssVar.colorBgContainer};
  `,
  header: css`
    flex: none;
    min-height: 56px;
    padding: 8px 16px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  headerTitle: css`
    min-width: 0;
  `,
  name: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  preview: css`
    flex: 1;
    min-height: 0;
    overflow: hidden;
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

  const handleBack = () => {
    void setFileParam(null)
    setCurrentViewItemId(undefined)
    setMode('explorer')
  }

  if (!item) return null

  return (
    <Flexbox className={styles.overlay} style={{ height: '100%' }}>
      <Flexbox horizontal align='center' className={styles.header} gap={4}>
        <ActionIcon icon={ArrowLeft} onClick={handleBack} title='返回' />
        <Flexbox horizontal align='center' className={styles.headerTitle} flex={1} gap={8}>
          <Text strong className={styles.name} title={item.name}>
            {item.name}
          </Text>
        </Flexbox>
      </Flexbox>
      <Flexbox className={styles.preview}>
        <FileContent key={item.id} item={item} />
      </Flexbox>
    </Flexbox>
  )
})

FileEditor.displayName = 'FileEditor'

export default FileEditor
