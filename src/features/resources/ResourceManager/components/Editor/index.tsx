'use client'

import { ActionIcon, Text, Flex } from '@pure/ui'
import { createStaticStyles, cssVar } from '@lobehub/ui'
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
    min-height: 40px;
    padding: 0px 16px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
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
    setFileParam(null)
    setCurrentViewItemId(undefined)
    setMode('explorer')
  }

  if (!item) return null

  return (
    <Flex className={[styles.overlay, 'flex-col h-full']}>
      <Flex className={[styles.header, 'items-center gap-1']}>
        <ActionIcon size='small' icon={ArrowLeft} onClick={handleBack} title='返回' />
        <Flex className={['min-w-0', 'items-center flex-1 gap-2']}>
          <Text strong className={'truncate'} title={item.name}>
            {item.name}
          </Text>
        </Flex>
      </Flex>
      <Flex className={['flex-1 min-h-0 overflow-hidden', 'flex-col']}>
        <FileContent key={item.id} item={item} />
      </Flex>
    </Flex>
  )
})

FileEditor.displayName = 'FileEditor'

export default FileEditor
